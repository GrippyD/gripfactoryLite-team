/**
 * THE LAB STATION (canon 0.30.362). The lab package's JSON API and its three
 * read-only feeds (lab_tests.js), in the app's TypeScript. The station page
 * itself is Compliance, Testing, the Internal tab (labpage.ts); index.ts owns
 * the /station/lab_tests redirect and mounts handleLab on /api/lab/* and the
 * feed paths.
 *
 * WRITES. Every create is INSERT OR IGNORE on a client minted id, so a phone
 * that retries after a dropped connection lands the row once. Every
 * correction is an UPDATE of named columns with the merged row re-validated
 * against labrules first. Nothing is deleted: a void sets voided_at and the
 * feeds carry it. Every write goes in ONE db.batch with its record_change_log
 * rows. A create's log rows are guarded by that request's write id, so a
 * retry logs nothing whatever the clock says. A correction's log rows are
 * guarded by the update's own updated_at, so a stale correction logs nothing
 * and a landed write never goes unlogged (BRIEF V24 law 4).
 *
 * WHO. The operator stored on a row is the actor's person id, as the app's
 * other writes store it. With no actor (or the service token) the package's
 * typed fallback stands: x-lab-operator, stored typed:<name>.
 *
 * METRC. GET /api/lab/metrc/:tag reads the app's metrc_packages mirror (law
 * 5). There is no Metrc import route: the mirror is fed by the app's mounts.
 */

import { roundGrams, SYSTEM_REASON } from "./config";
import type { Identity } from "./identity";
import * as R from "./labrules";
import { LAB_CONSOLE_SET_SQL } from "./labvocab";
import { SERVICE_IDENTITY } from "./service";

export const LAB_API_PREFIX = "/api/lab/";
export const LAB_FEED_PATHS: readonly string[] = ["/feeds/lab-internal-tests.json", "/feeds/lab-compliance.json", "/feeds/lab-op-results.json"];
/** Where the package's /station/lab_tests link lands (index.ts answers it). */
export const LAB_STATION_REDIRECT = "/compliance/testing?tab=internal";

const FEED_DEFAULT_LIMIT = 500;
const FEED_MAX_LIMIT = 2000;
const LIST_DEFAULT = 100;
const LIST_MAX = 1000;
// D1 binds at most 100 parameters per statement; 90 leaves room.
const BIND_CHUNK = 90;
// The most rows one import request lands. D1 counts every statement against
// its per invocation query ceiling (1,000 on the paid plan), so a whole
// season's LightLab export must arrive in slices; the page slices.
const IMPORT_MAX_ROWS = 900;
// Only the first 50 refusals are listed; the count is always the whole number.
const REFUSED_LIST_CAP = 50;
// Every write must carry this header. A browser adds it only from the page's
// own script, which forces a CORS preflight that this worker never answers,
// so a cross site form POST riding an Access cookie is refused here.
const CLIENT_HEADER = "x-lab-client";
const OPERATOR_HEADER = "x-lab-operator";
const SEED_SINCE = "2000-01-01T00:00:00.000Z";
const MAX_BODY = 6 * 1024 * 1024; // a LightLab export of a whole season is about 2 MB
const RUN_CAP = 5000;
const VOID_REASON_MAX = 300;
const TYPED_NAME_MAX = 80;

// ---------------------------------------------------------------- rows

type Cell = string | number | null;

/** One lab_internal_tests row as migration 0090 stores it. */
export type LabInternalTestRow = {
  id: string;
  tested_at: string | null;
  tested_at_source: "auto" | "typed" | "sheet" | "notes-time" | "missing";
  location: string;
  reason: string;
  license: string | null;
  metrc_tag: string | null;
  metrc_tag_raw: string | null;
  sample_type: string;
  moisture_pct: number | null;
  water_activity: number | null;
  thc_pct: number | null;
  notes: string;
  operator: string | null;
  source: "station" | "workbook";
  sheet_name: string | null;
  sheet_row: number | null;
  created_at: string;
  updated_at: string;
  changed_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

/** One lab_compliance_samples row as migration 0090 stores it. */
export type LabComplianceRow = {
  id: string;
  program: string;
  license: string;
  market: string;
  strain: string | null;
  item_name: string | null;
  source_metrc_tag: string;
  batch_weight_g: number | null;
  harvest_batch: string | null;
  sample_tag: string | null;
  required_test: string;
  net_weight_g: number | null;
  testing_facility: string | null;
  entered_testing_on: string | null;
  finished_testing_on: string | null;
  thc_potency_pct: number | null;
  status: string;
  fail_reason: string | null;
  notes: string;
  scheduled_at: string;
  operator: string | null;
  source: "station" | "workbook";
  sheet_name: string | null;
  sheet_row: number | null;
  created_at: string;
  updated_at: string;
  changed_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

/** One lab_op_results row as migration 0090 stores it. */
export type LabOpRow = Omit<R.OpResultRow, "material_class" | "terpenes_level"> & {
  material_class: string | null;
  terpenes_level: string | null;
  source: "station" | "workbook";
  sheet_row: number | null;
  imported_at: string;
  changed_at: string;
  voided_at: string | null;
  void_reason: string | null;
};

/** One lab_sample_schedule row. */
export type LabScheduleRow = { day: string; hour: number; location: string; operator: string | null; updated_at: string };

/** The additive name a list carries for a row's operator, so the station never shows a person id. */
export type LabOperatorName = { operator_name: string | null };

/** A compliance row as the list answers it. */
export type LabComplianceListRow = LabComplianceRow & LabOperatorName & { turnaround_days: number | null; readiness?: R.Readiness | null };

/** operator_name for a list: the person's display_name when operator is a person id, the
 * typed name without its typed: prefix, else null. A correlated subquery, never a join, so
 * the list's unqualified WHERE and ORDER BY columns stay unambiguous (people has id too). */
function operatorNameSql(table: "lab_internal_tests" | "lab_compliance_samples" | "lab_op_results"): string {
  const op = `${table}.operator`;
  return `CASE WHEN substr(${op}, 1, 6) = 'typed:' THEN substr(${op}, 7) ELSE (SELECT display_name FROM people WHERE people.id = ${op}) END AS operator_name`;
}

type FeedRow = Record<string, unknown> & { changed_at: string };
type JsonObject = Record<string, unknown>;
type Stamps = { operator: string | null; source: "station"; created_at: string; updated_at: string; changed_at: string };
type InternalInsert = R.InternalTestRow & Stamps;
type ComplianceInsert = R.ComplianceSampleRow & Stamps;
type OpInsert = R.OpResultRow & { source: "station"; imported_at: string; changed_at: string; write_id: string };

// ---------------------------------------------------------------- answers

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

/** write_id is the log guard's key. A row read with SELECT * drops it before JSON leaves. */
function withoutWriteId<T extends object>(row: T): T {
  if (!("write_id" in row)) return row;
  const copy = { ...row };
  delete (copy as { write_id?: unknown }).write_id;
  return copy;
}

const bad = (error: string, status = 400, more: Record<string, unknown> = {}): Response => json({ ok: false, error, ...more }, status);

const iso = (ms: number): string => new Date(ms).toISOString();

/** An absent or blank parameter takes the default. The package's own clamp read an
 * absent limit as 0 and so as 1; its README's law is the default (500 on a feed). */
const clampInt = (v: string | null, lo: number, hi: number, dflt: number): number => {
  if (v == null || v.trim() === "") return dflt;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

const changesOf = (res: unknown): number => Number((res as { meta?: { changes?: number } } | null | undefined)?.meta?.changes) || 0;

const isObject = (v: unknown): v is JsonObject => !!v && typeof v === "object";

const hasOwn = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);

/** A client that cannot mint an id gets one here, but the page always sends
 * its own so a retry is a no-op. */
export const mintId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------- who

const isPerson = (actor: Identity | null): actor is Identity => !!actor && !!actor.id && actor.id !== SERVICE_IDENTITY.id;

/** The person id on the change log: null for the typed fallback and the service token. */
function actorIdOf(actor: Identity | null): string | null {
  return isPerson(actor) ? actor.id : null;
}

/** The typed name from x-lab-operator, decoded (the page URI encodes it), trimmed, capped. */
function typedNameOf(header: string | null): string | null {
  let typed = header || "";
  try {
    typed = decodeURIComponent(typed);
  } catch {
    /* sent raw by an older page */
  }
  typed = typed.trim().slice(0, TYPED_NAME_MAX);
  return typed || null;
}

/** Who a write is from: the stored operator, the name to show, and whether it was typed. */
export type LabWho = { operator: string | null; name: string | null; typed: boolean };

export function labWho(actor: Identity | null, header: string | null): LabWho {
  if (isPerson(actor)) return { operator: actor.id, name: actor.display_name || null, typed: false };
  const typed = typedNameOf(header);
  return typed ? { operator: `typed:${typed}`, name: typed, typed: true } : { operator: null, name: null, typed: false };
}

/** The operator stored on the row: the actor's person id, else typed:<name>, else null. */
export function labOperator(actor: Identity | null, header: string | null): string | null {
  return labWho(actor, header).operator;
}

// ---------------------------------------------------------------- bodies

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return { ok: false, error: "body-too-large" };
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, error: "bad-json" };
  }
}

async function readObject(request: Request): Promise<{ ok: true; body: JsonObject } | { ok: false; error: string }> {
  const read = await readJson(request);
  if (!read.ok) return read;
  return isObject(read.body) ? { ok: true, body: read.body } : { ok: false, error: "bad-json" };
}

async function readText(request: Request): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return { ok: false, error: "body-too-large" };
  try {
    return { ok: true, text: await request.text() };
  } catch {
    return { ok: false, error: "bad-body" };
  }
}

/** Grams entering through the API are whole, round half up (the app's roundGrams),
 * before the rules see them. A value that is not a number, or one outside GRAMS_RANGE,
 * is left as sent for the rules to refuse (rounding -0.4 to 0 would let it pass). */
function gramsIn(v: unknown): unknown {
  const inRange = (n: number): boolean => Number.isFinite(n) && n >= R.GRAMS_RANGE[0] && n <= R.GRAMS_RANGE[1];
  if (typeof v === "number") return inRange(v) ? roundGrams(v) : v;
  if (typeof v !== "string") return v;
  const s = v.trim().replace(/%/g, "");
  if (s === "") return v;
  const n = Number(s);
  return inRange(n) ? roundGrams(n) : v;
}

const GRAM_FIELDS = ["batch_weight_g", "net_weight_g"] as const;

function roundGramFields(body: JsonObject): void {
  for (const f of GRAM_FIELDS) if (hasOwn(body, f)) body[f] = gramsIn(body[f]);
}

// ---------------------------------------------------------------- the change log

const LOG_COLS = "id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at";

/** A random UUID (version 4 shape) minted in SQL, one per row an INSERT ... SELECT writes. */
const UUID_SQL =
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))";

type LogEntry = { field: string; from: unknown; to: unknown };

const logText = (v: unknown): string | null => (v == null ? null : String(v));

/** logsForInsert's rule: each non-null, non-empty stored field, from null to its value. */
function insertEntries(record: Record<string, unknown>): LogEntry[] {
  const out: LogEntry[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (value == null || value === "") continue;
    out.push({ field, from: null, to: value });
  }
  return out;
}

/** record_change_log rows that land only when `guardSql` (SELECT 1 over the written row,
 * matched on the write's own key) finds the write, so they ride in the write's batch. */
function guardedLogs(
  db: D1Database,
  table: string,
  recordId: string,
  entries: readonly LogEntry[],
  actorId: string | null,
  reason: string,
  at: string,
  guardSql: string,
  guardBinds: readonly Cell[]
): D1PreparedStatement[] {
  return entries.map((e) =>
    db
      .prepare(`INSERT INTO record_change_log (${LOG_COLS}) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${guardSql})`)
      .bind(crypto.randomUUID(), table, recordId, e.field, logText(e.from), logText(e.to), actorId, reason, at, ...guardBinds)
  );
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return a == null && b == null;
}

// ---------------------------------------------------------------- the feeds

// Same envelope as /feeds/trim-weighs.json so the existing pollers reuse their
// reader: since compares against changed_at STRICTLY after, oldest first,
// next_since is the last row's changed_at. A cursor is any parseable instant;
// the record time floor in labrules does not apply to it.
function parseSince(raw: string | null): string | undefined {
  if (raw == null || raw === "") return SEED_SINCE;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? iso(ms) : undefined;
}

// A PAGE NEVER ENDS INSIDE A RUN OF EQUAL changed_at. With a single column
// cursor and "strictly after", cutting a page between two rows that share a
// changed_at loses every later row of that run forever. So when the row past
// the limit shares the last row's stamp, the whole run is appended before the
// page is answered; the page can then exceed limit, which is honest, and
// next_since is always strictly past a complete run.
async function feed(db: D1Database, url: URL, table: string, name: string): Promise<Response> {
  const since = parseSince(url.searchParams.get("since"));
  if (since === undefined) return bad("bad-since");
  const limit = clampInt(url.searchParams.get("limit"), 1, FEED_MAX_LIMIT, FEED_DEFAULT_LIMIT);
  const live = url.searchParams.get("live") === "1";
  const idCol = table === "lab_op_results" ? "test_id" : "id";
  const liveSql = live ? "AND voided_at IS NULL" : "";
  const got = await db
    .prepare(`SELECT * FROM ${table} WHERE changed_at > ? ${liveSql} ORDER BY changed_at ASC, ${idCol} ASC LIMIT ?`)
    .bind(since, limit + 1)
    .all<FeedRow>();
  const fetched = got.results ?? [];
  let rows = fetched.slice(0, limit);
  let more = fetched.length > limit;
  let runCompleted = 0;
  if (more && fetched[limit].changed_at === rows[rows.length - 1].changed_at) {
    const stamp = rows[rows.length - 1].changed_at;
    const rest = await db
      .prepare(`SELECT * FROM ${table} WHERE changed_at = ? AND ${idCol} > ? ${liveSql} ORDER BY ${idCol} ASC LIMIT ?`)
      .bind(stamp, rows[rows.length - 1][idCol], RUN_CAP)
      .all<FeedRow>();
    runCompleted = (rest.results ?? []).length;
    rows = rows.concat(rest.results ?? []);
    const beyond = await db.prepare(`SELECT 1 AS x FROM ${table} WHERE changed_at > ? ${liveSql} LIMIT 1`).bind(stamp).first();
    more = !!beyond;
  }
  for (const r of rows) {
    delete r.write_id;
    if (r.raw_json) {
      try {
        r.raw = JSON.parse(String(r.raw_json));
      } catch {
        r.raw = null;
      }
      delete r.raw_json;
    }
  }
  return json({
    feed: name,
    generated_at: iso(Date.now()),
    since,
    count: rows.length,
    next_since: rows.length ? rows[rows.length - 1].changed_at : since,
    more,
    run_completed: runCompleted,
    rows,
  });
}

// ---------------------------------------------------------------- bench readings

const NEEDS_ATTENTION_SQL = "(tested_at IS NULL OR location = '' OR reason = '' OR sample_type = '' OR (metrc_tag IS NULL AND metrc_tag_raw IS NOT NULL))";

async function listInternal(db: D1Database, url: URL): Promise<Response> {
  const limit = clampInt(url.searchParams.get("limit"), 1, LIST_MAX, LIST_DEFAULT);
  const where: string[] = [];
  const binds: Cell[] = [];
  if (url.searchParams.get("include_voided") !== "1") where.push("voided_at IS NULL");
  const loc = url.searchParams.get("location");
  if (loc) {
    where.push("location = ?");
    binds.push(loc);
  }
  const tag = url.searchParams.get("tag");
  if (tag) {
    where.push("(metrc_tag = ? OR metrc_tag LIKE ?)");
    binds.push(tag.toUpperCase(), `%${tag.toUpperCase()}`);
  }
  const fromDay = R.parseDay(url.searchParams.get("from"));
  if (fromDay) {
    where.push("tested_at >= ?");
    binds.push(`${fromDay}T00:00:00.000Z`);
  }
  if (url.searchParams.get("needs_attention") === "1") where.push(NEEDS_ATTENTION_SQL);
  const sql = `SELECT *, ${operatorNameSql("lab_internal_tests")} FROM lab_internal_tests ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY (tested_at IS NULL) ASC, COALESCE(tested_at, created_at) DESC, id DESC LIMIT ?`;
  const got = await db.prepare(sql).bind(...binds, limit).all<LabInternalTestRow & LabOperatorName>();
  return json({ ok: true, rows: (got.results ?? []).map(withoutWriteId) });
}

const INTERNAL_COLS = [
  "id",
  "tested_at",
  "tested_at_source",
  "location",
  "reason",
  "license",
  "metrc_tag",
  "metrc_tag_raw",
  "sample_type",
  "moisture_pct",
  "water_activity",
  "thc_pct",
  "notes",
  "operator",
  "source",
  "created_at",
  "updated_at",
  "changed_at",
] as const satisfies readonly (keyof InternalInsert & keyof LabInternalTestRow)[];

/** The columns a bench correction writes (tested_at_source is derived). */
const INTERNAL_SETS = [
  "tested_at",
  "location",
  "reason",
  "license",
  "metrc_tag",
  "metrc_tag_raw",
  "sample_type",
  "moisture_pct",
  "water_activity",
  "thc_pct",
  "notes",
] as const satisfies readonly (keyof R.InternalTestRow & keyof LabInternalTestRow)[];

async function createInternal(db: D1Database, request: Request, actor: Identity | null): Promise<Response> {
  const read = await readObject(request);
  if (!read.ok) return bad(read.error);
  const body = read.body;
  const nowMs = Date.now();
  if (!body.id) body.id = mintId("lt");
  const v = R.validateInternalTest(body, nowMs, { observedAt: body.observed_at });
  if (!v.ok) return bad(v.error);
  const r = v.row;
  const now = iso(nowMs);
  const writeId = crypto.randomUUID();
  const row: InternalInsert = { ...r, operator: labOperator(actor, request.headers.get(OPERATOR_HEADER)), source: "station", created_at: now, updated_at: now, changed_at: now };
  const insertCols = [...INTERNAL_COLS, "write_id"] as const;
  const ins = db
    .prepare(`INSERT OR IGNORE INTO lab_internal_tests (${insertCols.join(",")}) VALUES (${insertCols.map(() => "?").join(",")})`)
    .bind(...insertCols.map((c) => (c === "write_id" ? writeId : row[c])));
  const logs = guardedLogs(
    db,
    "lab_internal_tests",
    r.id,
    insertEntries(Object.fromEntries(INTERNAL_COLS.map((c) => [c, row[c]]))),
    actorIdOf(actor),
    SYSTEM_REASON.lab_station,
    now,
    "SELECT 1 FROM lab_internal_tests WHERE id = ? AND write_id = ?",
    [r.id, writeId]
  );
  const res = await db.batch([ins, ...logs]);
  // A retry that found its row already there is a no-op: no row, no log.
  const created = changesOf(res[0]) === 1;
  const stored = await db.prepare("SELECT * FROM lab_internal_tests WHERE id = ?").bind(r.id).first<LabInternalTestRow>();
  // OR IGNORE also swallows a CHECK failure: no row and no error. Named.
  if (!stored) return bad("insert-refused-by-schema", 500);
  return json({ ok: true, created, row: withoutWriteId(stored) }, created ? 201 : 200);
}

async function patchInternal(db: D1Database, request: Request, id: string, actor: Identity | null): Promise<Response> {
  const read = await readObject(request);
  if (!read.ok) return bad(read.error);
  const body = read.body;
  const cur = await db.prepare("SELECT * FROM lab_internal_tests WHERE id = ?").bind(id).first<LabInternalTestRow>();
  if (!cur) return bad("not-found", 404);
  if (cur.voided_at) return bad("voided", 409);
  // Optimistic concurrency: the page sends the updated_at it loaded; a row
  // that moved since answers stale and the operator sees the newer values.
  if (body.if_updated_at != null && body.if_updated_at !== cur.updated_at) return bad("stale", 409, { row: withoutWriteId(cur) });
  const merged: JsonObject = { ...cur };
  const touched: string[] = [];
  for (const k of R.INTERNAL_TEST_EDITABLE) {
    if (hasOwn(body, k)) {
      merged[k] = body[k];
      touched.push(k);
    }
  }
  if (!touched.length) return bad("nothing-to-change");
  // A dated row cannot be blanked back to no date: a correction sends a date
  // or leaves the field out. A row that never had one keeps NULL unless a
  // date is actually given.
  if (touched.includes("tested_at") && (body.tested_at == null || body.tested_at === "") && cur.tested_at) return bad("tested_at-blank");
  const v = R.validateInternalTest(merged, Date.now(), { allowMissingDate: true });
  if (!v.ok) return bad(v.error);
  const r: Record<(typeof INTERNAL_SETS)[number], Cell> = { ...v.row };
  // The tag pair is rewritten only when the tag was touched; otherwise a
  // notes only correction would erase metrc_tag_raw on a bad tag row.
  if (!touched.includes("metrc_tag")) {
    r.metrc_tag = cur.metrc_tag;
    r.metrc_tag_raw = cur.metrc_tag_raw;
  }
  // Provenance follows the instant: unchanged instant, unchanged source.
  const source = r.tested_at === cur.tested_at ? cur.tested_at_source : r.tested_at == null ? "missing" : "typed";
  const now = iso(Date.now());
  const changed: LogEntry[] = [];
  for (const c of INTERNAL_SETS) if (!sameValue(cur[c], r[c])) changed.push({ field: c, from: cur[c], to: r[c] });
  if (source !== cur.tested_at_source) changed.push({ field: "tested_at_source", from: cur.tested_at_source, to: source });
  if (!changed.length) return json({ ok: true, row: withoutWriteId(cur), unchanged: true });
  const upd = db
    .prepare(
      `UPDATE lab_internal_tests SET ${INTERNAL_SETS.map((c) => `${c} = ?`).join(", ")}, tested_at_source = ?, updated_at = ?, changed_at = ? WHERE id = ? AND voided_at IS NULL AND updated_at = ?`
    )
    .bind(...INTERNAL_SETS.map((c) => r[c]), source, now, now, id, cur.updated_at);
  const logs = guardedLogs(
    db,
    "lab_internal_tests",
    id,
    changed,
    actorIdOf(actor),
    SYSTEM_REASON.lab_station,
    now,
    "SELECT 1 FROM lab_internal_tests WHERE id = ? AND updated_at = ? AND voided_at IS NULL",
    [id, now]
  );
  const res = await db.batch([upd, ...logs]);
  // Zero rows: a void or another correction landed between our read and this write.
  if (changesOf(res[0]) !== 1) return bad("stale", 409);
  const stored = await db.prepare("SELECT * FROM lab_internal_tests WHERE id = ?").bind(id).first<LabInternalTestRow>();
  return json({ ok: true, row: stored ? withoutWriteId(stored) : stored });
}

async function voidRow(db: D1Database, request: Request, table: string, id: string, actor: Identity | null, idCol = "id"): Promise<Response> {
  const read = await readJson(request);
  if (!read.ok) return bad(read.error);
  const body = read.body;
  const reason = String((isObject(body) && body.reason) || "")
    .trim()
    .slice(0, VOID_REASON_MAX);
  if (!reason) return bad("reason-required");
  const now = iso(Date.now());
  const upd = db.prepare(`UPDATE ${table} SET voided_at = ?, void_reason = ?, changed_at = ? WHERE ${idCol} = ? AND voided_at IS NULL`).bind(now, reason, now, id);
  const logs = guardedLogs(
    db,
    table,
    id,
    [
      { field: "voided_at", from: null, to: now },
      { field: "void_reason", from: null, to: reason },
    ],
    actorIdOf(actor),
    reason,
    now,
    `SELECT 1 FROM ${table} WHERE ${idCol} = ? AND voided_at = ? AND void_reason = ?`,
    [id, now, reason]
  );
  const res = await db.batch([upd, ...logs]);
  if (changesOf(res[0]) !== 1) {
    const exists = await db.prepare(`SELECT voided_at FROM ${table} WHERE ${idCol} = ?`).bind(id).first();
    return exists ? bad("already-voided", 409) : bad("not-found", 404);
  }
  return json({ ok: true, voided_at: now });
}

// ---------------------------------------------------------------- compliance samples

const COMPLIANCE_COLS = [
  "id",
  "program",
  "license",
  "market",
  "strain",
  "item_name",
  "source_metrc_tag",
  "batch_weight_g",
  "harvest_batch",
  "sample_tag",
  "required_test",
  "net_weight_g",
  "testing_facility",
  "entered_testing_on",
  "finished_testing_on",
  "thc_potency_pct",
  "status",
  "fail_reason",
  "notes",
  "scheduled_at",
  "operator",
  "source",
  "created_at",
  "updated_at",
  "changed_at",
] as const satisfies readonly (keyof ComplianceInsert & keyof LabComplianceRow)[];

type ReadinessRow = R.ReadinessReading & { metrc_tag: string };

// Readiness for a set of source tags, from the bench readings: one query per
// 90 tags (D1 binds at most 100 parameters per statement).
async function readinessByTag(db: D1Database, tags: readonly string[]): Promise<Record<string, R.Readiness>> {
  const out: Record<string, R.Readiness> = {};
  const uniq = [...new Set(tags.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += BIND_CHUNK) {
    const chunk = uniq.slice(i, i + BIND_CHUNK);
    const got = await db
      .prepare(
        `SELECT metrc_tag, reason, water_activity, tested_at, voided_at, id FROM lab_internal_tests WHERE metrc_tag IN (${chunk.map(() => "?").join(",")}) AND water_activity IS NOT NULL AND voided_at IS NULL`
      )
      .bind(...chunk)
      .all<ReadinessRow>();
    const byTag: Record<string, ReadinessRow[]> = {};
    for (const r of got.results ?? []) (byTag[r.metrc_tag] = byTag[r.metrc_tag] || []).push(r);
    for (const t of chunk) out[t] = R.readiness(byTag[t] || []);
  }
  return out;
}

async function listCompliance(db: D1Database, url: URL): Promise<Response> {
  const limit = clampInt(url.searchParams.get("limit"), 1, LIST_MAX, LIST_DEFAULT);
  const where: string[] = [];
  const binds: Cell[] = [];
  if (url.searchParams.get("include_voided") !== "1") where.push("voided_at IS NULL");
  const program = url.searchParams.get("program");
  if (program) {
    if (!(R.PROGRAMS as readonly string[]).includes(program)) return bad("program");
    where.push("program = ?");
    binds.push(program);
  }
  const status = url.searchParams.get("status");
  if (status) {
    const list = status.split(",").map((s) => R.normalizeStatus(s));
    const known = list.filter((s): s is R.LabStatus => !!s);
    if (known.length !== list.length) return bad("status");
    // Distinct before binding: a long repeated list stays under D1's 100 bound parameters.
    const distinct = [...new Set(known)];
    where.push(`status IN (${distinct.map(() => "?").join(",")})`);
    binds.push(...distinct);
  }
  const tag = url.searchParams.get("tag");
  if (tag) {
    const t = `%${tag.toUpperCase()}`;
    where.push("(source_metrc_tag LIKE ? OR sample_tag LIKE ?)");
    binds.push(t, t);
  }
  const sql = `SELECT *, ${operatorNameSql("lab_compliance_samples")} FROM lab_compliance_samples ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY scheduled_at DESC, id DESC LIMIT ?`;
  const got = await db.prepare(sql).bind(...binds, limit).all<LabComplianceRow & LabOperatorName>();
  const found = got.results ?? [];
  const nowMs = Date.now();
  const scheduledTags = found.filter((r) => r.status === "scheduled").map((r) => r.source_metrc_tag);
  const ready = scheduledTags.length ? await readinessByTag(db, scheduledTags) : {};
  const rows = found.map((r) => {
    const src = withoutWriteId(r);
    const out: LabComplianceListRow = { ...src, turnaround_days: R.turnaroundDays(r.entered_testing_on, r.finished_testing_on, nowMs) };
    // Readiness is only computed while a sample is scheduled.
    if (r.status === "scheduled") out.readiness = ready[r.source_metrc_tag] || null;
    return out;
  });
  return json({ ok: true, rows });
}

async function createCompliance(db: D1Database, request: Request, actor: Identity | null): Promise<Response> {
  const read = await readObject(request);
  if (!read.ok) return bad(read.error);
  const body = read.body;
  const nowMs = Date.now();
  if (!body.id) body.id = mintId("cs");
  roundGramFields(body);
  const v = R.validateComplianceSample(body, nowMs);
  if (!v.ok) return bad(v.error);
  const r = v.row;
  const now = iso(nowMs);
  const writeId = crypto.randomUUID();
  const row: ComplianceInsert = { ...r, operator: labOperator(actor, request.headers.get(OPERATOR_HEADER)), source: "station", created_at: now, updated_at: now, changed_at: now };
  const insertCols = [...COMPLIANCE_COLS, "write_id"] as const;
  const ins = db
    .prepare(`INSERT OR IGNORE INTO lab_compliance_samples (${insertCols.join(",")}) VALUES (${insertCols.map(() => "?").join(",")})`)
    .bind(...insertCols.map((c) => (c === "write_id" ? writeId : row[c])));
  const logs = guardedLogs(
    db,
    "lab_compliance_samples",
    r.id,
    insertEntries(Object.fromEntries(COMPLIANCE_COLS.map((c) => [c, row[c]]))),
    actorIdOf(actor),
    SYSTEM_REASON.lab_station,
    now,
    "SELECT 1 FROM lab_compliance_samples WHERE id = ? AND write_id = ?",
    [r.id, writeId]
  );
  const res = await db.batch([ins, ...logs]);
  const created = changesOf(res[0]) === 1;
  const stored = await db.prepare("SELECT * FROM lab_compliance_samples WHERE id = ?").bind(r.id).first<LabComplianceRow>();
  if (!stored) return bad("insert-refused-by-schema", 500);
  return json({ ok: true, created, row: withoutWriteId(stored) }, created ? 201 : 200);
}

async function patchCompliance(db: D1Database, request: Request, id: string, actor: Identity | null): Promise<Response> {
  const read = await readObject(request);
  if (!read.ok) return bad(read.error);
  const body = read.body;
  const cur = await db.prepare("SELECT * FROM lab_compliance_samples WHERE id = ?").bind(id).first<LabComplianceRow>();
  if (!cur) return bad("not-found", 404);
  if (cur.voided_at) return bad("voided", 409);
  if (body.if_updated_at != null && body.if_updated_at !== cur.updated_at) return bad("stale", 409, { row: withoutWriteId(cur) });
  // Only the grams a correction names are rounded; a stored value it does not name is kept as stored.
  roundGramFields(body);
  const merged: JsonObject = { ...cur };
  const touched: string[] = [];
  for (const k of R.COMPLIANCE_EDITABLE) {
    if (hasOwn(body, k)) {
      merged[k] = body[k];
      touched.push(k);
    }
  }
  if (!touched.length) return bad("nothing-to-change");
  // The stored status and required test: a row that already disagrees is never rewritten (BRIEF V25 law 1a).
  const v = R.validateComplianceSample(merged, Date.now(), { status: cur.status, required_test: cur.required_test });
  if (!v.ok) return bad(v.error);
  const r = v.row;
  const now = iso(Date.now());
  const changed: LogEntry[] = [];
  for (const c of R.COMPLIANCE_EDITABLE) if (!sameValue(cur[c], r[c])) changed.push({ field: c, from: cur[c], to: r[c] });
  if (!changed.length) return json({ ok: true, row: withoutWriteId(cur), unchanged: true });
  const upd = db
    .prepare(
      `UPDATE lab_compliance_samples SET ${R.COMPLIANCE_EDITABLE.map((c) => `${c} = ?`).join(", ")}, updated_at = ?, changed_at = ? WHERE id = ? AND voided_at IS NULL AND updated_at = ?`
    )
    .bind(...R.COMPLIANCE_EDITABLE.map((c) => r[c]), now, now, id, cur.updated_at);
  const logs = guardedLogs(
    db,
    "lab_compliance_samples",
    id,
    changed,
    actorIdOf(actor),
    SYSTEM_REASON.lab_station,
    now,
    "SELECT 1 FROM lab_compliance_samples WHERE id = ? AND updated_at = ? AND voided_at IS NULL",
    [id, now]
  );
  const res = await db.batch([upd, ...logs]);
  if (changesOf(res[0]) !== 1) return bad("stale", 409);
  const stored = await db.prepare("SELECT * FROM lab_compliance_samples WHERE id = ?").bind(id).first<LabComplianceRow>();
  return json({ ok: true, row: stored ? withoutWriteId(stored) : stored });
}

// The sheet's "Testing Autofill CSV" tab: the Metrc bulk template that moves
// sample packages into testing. Three header rows exactly as the sheet had
// them, then one line per sample: sample tag, "In Testing", net grams, today,
// and the source package it was cut from.
const AUTOFILL_HEADERS: readonly (readonly string[])[] = [
  ["line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "line in repeaterLines", "ingredient in line.Ingredients", "ingredient in line.Ingredients", "ingredient in line.Ingredients", "ingredient in line.Ingredients", "ingredient in line.Ingredients"],
  ["line.TagId", "line.LocationId", "line.ItemId", "line.UseSameItem", "line.Quantity", "line.UnitOfMeasureId", "line.Note", "line.ActualDate", "line.ExpirationDate", "line.SellByDate", "line.UseByDate", "line.IsDonation", "templateIngredients.Quantity", "templateIngredients.UnitOfMeasureId", "ingredient.PackageId", "ingredient.Quantity", "ingredient.UnitOfMeasureId", "ingredient.FinishPackage", "ingredient.FinishDate"],
  ["Tag Number", "Location Name", "Item Name", "Use Same Item", "Quantity", "Unit Of Measure", "Note", "Actual Date", "Expiration Date", "Sell By Date", "Use By Date", "Is Donation", "Template Ingredients Quantity", "Template Ingredients Unit Of Measure", "Package Number", "Ingredient Quantity", "Ingredient Unit Of Measure", "Ingredient Finish Package", "Ingredient Finish Date"],
];

const csvCell = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One sample on the autofill CSV. */
export type AutofillRow = { sample_tag: unknown; source_metrc_tag: unknown; net_weight_g: unknown };

export function autofillCsv(rows: readonly AutofillRow[], todayMdy: string): string {
  const lines = AUTOFILL_HEADERS.map((h) => h.map(csvCell).join(","));
  for (const r of rows) {
    const line: unknown[] = new Array(19).fill("");
    line[0] = r.sample_tag;
    line[1] = "In Testing";
    line[4] = r.net_weight_g;
    line[5] = "Grams";
    line[7] = todayMdy;
    line[14] = r.source_metrc_tag;
    line[15] = r.net_weight_g;
    line[16] = "Grams";
    lines.push(line.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** The date as the sheet's own TODAY() cell was formatted (m/d/yy, "10/2/26"),
 * which is the format the lab has actually uploaded to Metrc. Not padded. */
export function metrcToday(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", year: "2-digit", month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return `${p.month}/${p.day}/${p.year}`;
}

export const AUTOFILL_MAX_IDS = BIND_CHUNK;

async function autofill(db: D1Database, url: URL): Promise<Response> {
  const all = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = all.filter((s) => R.ID_RE.test(s));
  if (!ids.length) return bad("ids");
  if (ids.length > AUTOFILL_MAX_IDS) return bad("too-many-ids", 400, { max: AUTOFILL_MAX_IDS, sent: ids.length });
  const got = await db
    .prepare(`SELECT id, sample_tag, source_metrc_tag, net_weight_g FROM lab_compliance_samples WHERE id IN (${ids.map(() => "?").join(",")}) AND voided_at IS NULL`)
    .bind(...ids)
    .all<{ id: string; sample_tag: string | null; source_metrc_tag: string; net_weight_g: number | null }>();
  const found = got.results ?? [];
  const rows = found.filter((r) => r.sample_tag && r.net_weight_g != null);
  const skipped = found.length - rows.length;
  const today = metrcToday(new Date());
  return new Response(autofillCsv(rows, today), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="metrc-testing-autofill-${today.replace(/\//g, "-")}.csv"`,
      "x-lab-skipped": String(skipped),
    },
  });
}

// ---------------------------------------------------------------- the Metrc lookup

type MirrorRow = {
  tag: string;
  item: string | null;
  category: string | null;
  item_strain: string | null;
  quantity: number | string | null;
  uom: string | null;
  source_harvests: string | null;
  source_packages: string | null;
  location: string | null;
  lab_test_status: string | null;
  packaged_date: string | null;
};

/** The package as the station's forms read it. */
export type LabMetrcPackage = {
  tag: string;
  item: string | null;
  category: string | null;
  strain: string | null;
  item_strain: string | null;
  quantity: number | string | null;
  unit: string | null;
  quantity_g: number | null;
  source_harvest: string | null;
  source_package: string | null;
  location: string | null;
  lab_test_status: string | null;
  packaged_date: string | null;
};

const GRAM_UOMS: readonly string[] = ["g", "gram", "grams"];

/** The quantity in whole grams when the mirror's unit is grams, else null. */
function quantityGrams(quantity: number | string | null, uom: string | null): number | null {
  if (uom == null || !GRAM_UOMS.includes(uom.trim().toLowerCase())) return null;
  if (quantity == null || quantity === "") return null;
  const n = Number(quantity);
  return Number.isFinite(n) ? roundGrams(n) : null;
}

// The tag's newest live row (gone_at IS NULL), else its newest row (law 5).
async function metrcLookup(db: D1Database, rawTag: string): Promise<Response> {
  let tag: string;
  try {
    tag = decodeURIComponent(rawTag);
  } catch {
    return bad("tag");
  }
  const t = R.normalizeTag(tag, null);
  if (!t.ok || !t.tag) return bad("tag");
  const row = await db
    .prepare(
      `SELECT tag, item, category, item_strain, quantity, uom, source_harvests, source_packages, location, lab_test_status, packaged_date
       FROM metrc_packages WHERE tag = ? ORDER BY (gone_at IS NULL) DESC, changed_at DESC LIMIT 1`
    )
    .bind(t.tag)
    .first<MirrorRow>();
  if (!row) return json({ ok: true, found: false });
  const out: LabMetrcPackage = {
    tag: row.tag,
    item: row.item ?? null,
    category: row.category ?? null,
    strain: row.item_strain ?? null,
    item_strain: row.item_strain ?? null,
    quantity: row.quantity ?? null,
    unit: row.uom ?? null,
    quantity_g: quantityGrams(row.quantity, row.uom),
    source_harvest: row.source_harvests ?? null,
    source_package: row.source_packages ?? null,
    location: row.location ?? null,
    lab_test_status: row.lab_test_status ?? null,
    packaged_date: row.packaged_date ?? null,
  };
  return json({ ok: true, found: true, row: out });
}

// ---------------------------------------------------------------- Orange Photonics

const OP_COLS = [
  "test_id",
  "tested_at",
  "tested_at_offset",
  "serial_number",
  "sample_id",
  "operator",
  "cultivar",
  "sample_type",
  "material_class",
  "notes",
  "weight_g",
  "temperature_c",
  "moisture_correction",
  "confidence",
  ...(Object.keys(R.OP_ANALYTES) as R.OpAnalyteKey[]),
  "terpenes_level",
  "nd_json",
  "raw_json",
  "source",
  "imported_at",
  "changed_at",
] as const satisfies readonly (keyof OpInsert)[];

// One set-based log statement per slice: for every row of the slice that THIS
// request inserted (its write_id is this request's key), one record_change_log
// row per non-null, non-empty column, from null to its value (logsForInsert's
// rule). A REAL that is whole logs as an integer, the way String() writes it.
// write_id itself is not a logged field.
const OP_LOG_VALUE = `CASE f.value ${OP_COLS.map((c) => `WHEN '${c}' THEN r.${c}`).join(" ")} END`;
const OP_LOG_SQL = `INSERT INTO record_change_log (${LOG_COLS})
  SELECT ${UUID_SQL}, 'lab_op_results', rid, field, NULL,
    CASE WHEN typeof(val) = 'real' AND val = CAST(val AS INTEGER) THEN CAST(CAST(val AS INTEGER) AS TEXT) ELSE CAST(val AS TEXT) END,
    ?, ?, ?
  FROM (
    SELECT r.test_id AS rid, f.value AS field, ${OP_LOG_VALUE} AS val
    FROM lab_op_results r
    JOIN json_each(?) ids ON ids.value = r.test_id
    CROSS JOIN json_each(?) f
    WHERE r.write_id = ? AND r.source = 'station'
  )
  WHERE val IS NOT NULL AND val <> ''`;

async function opImport(db: D1Database, request: Request, actor: Identity | null): Promise<Response> {
  const read = await readText(request);
  if (!read.ok) return bad(read.error);
  const parsed = R.csvToObjects(read.text, R.OP_HEADER);
  if (!parsed.ok) return parsed.error === "header" ? bad(parsed.error, 400, { missing: parsed.missing }) : bad(parsed.error);
  if (parsed.rows.length > IMPORT_MAX_ROWS) return bad("too-many-rows", 413, { max: IMPORT_MAX_ROWS, sent: parsed.rows.length });
  const nowMs = Date.now();
  const now = iso(nowMs);
  const writeId = crypto.randomUUID();
  const pending: OpInsert[] = [];
  const refused: { line: number; error: string; test_id: string | undefined }[] = [];
  const seen = new Set<string>();
  let dupInFile = 0;
  let refusedCount = 0;
  parsed.rows.forEach((o, i) => {
    const v = R.validateOpResult(o, nowMs);
    if (!v.ok) {
      refusedCount++;
      if (refused.length < REFUSED_LIST_CAP) refused.push({ line: i + 2, error: v.error, test_id: o["Test ID"] });
      return;
    }
    if (seen.has(v.row.test_id)) {
      dupInFile++;
      return;
    }
    seen.add(v.row.test_id);
    pending.push({ ...v.row, source: "station", imported_at: now, changed_at: now, write_id: writeId });
  });
  const insertCols = [...OP_COLS, "write_id"] as const;
  const insertSql = `INSERT OR IGNORE INTO lab_op_results (${insertCols.join(",")}) VALUES (${insertCols.map(() => "?").join(",")})`;
  const fieldsJson = JSON.stringify(OP_COLS);
  const actorId = actorIdOf(actor);
  let landed = 0;
  for (let i = 0; i < pending.length; i += BIND_CHUNK) {
    const slice = pending.slice(i, i + BIND_CHUNK);
    const inserts = slice.map((w) => db.prepare(insertSql).bind(...insertCols.map((c) => w[c])));
    const log = db.prepare(OP_LOG_SQL).bind(actorId, SYSTEM_REASON.lab_station, now, JSON.stringify(slice.map((w) => w.test_id)), fieldsJson, writeId);
    const res = await db.batch([...inserts, log]);
    for (let j = 0; j < inserts.length; j++) landed += changesOf(res[j]);
  }
  const alreadyThere = pending.length - landed;
  return json({ ok: true, rows: parsed.rows.length, landed, already_there: alreadyThere, duplicate_in_file: dupInFile, refused_count: refusedCount, refused });
}

const OP_LIST_COLS = [
  "test_id",
  "tested_at",
  "sample_id",
  "operator",
  "cultivar",
  "sample_type",
  "material_class",
  "notes",
  "weight_g",
  "confidence",
  ...(Object.keys(R.OP_ANALYTES) as R.OpAnalyteKey[]),
  "terpenes_level",
  "nd_json",
  "source",
  "imported_at",
] as const satisfies readonly (keyof LabOpRow)[];

async function listOp(db: D1Database, url: URL): Promise<Response> {
  const limit = clampInt(url.searchParams.get("limit"), 1, LIST_MAX, LIST_DEFAULT);
  const where = ["voided_at IS NULL"];
  const binds: Cell[] = [];
  const cls = url.searchParams.get("class");
  if (cls) {
    where.push("material_class = ?");
    binds.push(cls);
  }
  const fromDay = R.parseDay(url.searchParams.get("from"));
  if (fromDay) {
    where.push("tested_at >= ?");
    binds.push(`${fromDay}T00:00:00.000Z`);
  }
  const got = await db
    .prepare(`SELECT ${OP_LIST_COLS.join(",")}, ${operatorNameSql("lab_op_results")} FROM lab_op_results WHERE ${where.join(" AND ")} ORDER BY tested_at DESC LIMIT ?`)
    .bind(...binds, limit)
    .all<Pick<LabOpRow, (typeof OP_LIST_COLS)[number]> & LabOperatorName>();
  return json({ ok: true, rows: got.results ?? [] });
}

// ---------------------------------------------------------------- schedule

async function getSchedule(db: D1Database, url: URL): Promise<Response> {
  const from = R.parseDay(url.searchParams.get("from")) || iso(Date.now() - 86400e3).slice(0, 10);
  const days = clampInt(url.searchParams.get("days"), 1, 31, 7);
  const to = iso(Date.parse(`${from}T00:00:00Z`) + (days - 1) * 86400e3).slice(0, 10);
  const got = await db
    .prepare("SELECT day, hour, location, operator, updated_at FROM lab_sample_schedule WHERE day >= ? AND day <= ? ORDER BY day, hour, location")
    .bind(from, to)
    .all<LabScheduleRow>();
  return json({ ok: true, from, to, rows: got.results ?? [] });
}

// The cell's change is logged inside the write's own batch, ahead of the
// DELETE, with the old value read in SQL, so it is exact under a race.
const SCHEDULE_LOG_SQL = `INSERT INTO record_change_log (${LOG_COLS})
  SELECT ?, 'lab_sample_schedule', ?, 'locations', old, ?, ?, ?, ?
  FROM (SELECT (SELECT group_concat(location, '/') FROM (SELECT location FROM lab_sample_schedule WHERE day = ? AND hour = ? ORDER BY location)) AS old)
  WHERE old IS NOT ?`;

async function putSchedule(db: D1Database, request: Request, actor: Identity | null): Promise<Response> {
  const read = await readObject(request);
  if (!read.ok) return bad(read.error);
  const v = R.validateScheduleCell(read.body);
  if (!v.ok) return bad(v.error);
  const { day, hour, locations } = v.row;
  const now = iso(Date.now());
  const operator = labOperator(actor, request.headers.get(OPERATOR_HEADER));
  const to = [...locations].sort().join("/") || null;
  const cell = `${day}T${String(hour).padStart(2, "0")}`;
  const stmts: D1PreparedStatement[] = [
    db.prepare(SCHEDULE_LOG_SQL).bind(crypto.randomUUID(), cell, to, actorIdOf(actor), SYSTEM_REASON.lab_station, now, day, hour, to),
    db.prepare("DELETE FROM lab_sample_schedule WHERE day = ? AND hour = ?").bind(day, hour),
  ];
  for (const loc of locations) {
    stmts.push(db.prepare("INSERT INTO lab_sample_schedule (day, hour, location, operator, updated_at) VALUES (?,?,?,?,?)").bind(day, hour, loc, operator, now));
  }
  await db.batch(stmts);
  return json({ ok: true, day, hour, locations });
}

// ---------------------------------------------------------------- summary

// The Dashboard tab's numbers, computed live. Every count names its window.
async function summary(db: D1Database): Promise<Response> {
  const nowMs = Date.now();
  const day7 = iso(nowMs - 7 * 86400e3);
  const day30 = iso(nowMs - 30 * 86400e3).slice(0, 10);
  const [byStatus, bench7, benchAttention, benchLast, op7, turnaround, readyRows] = await Promise.all([
    db.prepare("SELECT program, status, COUNT(*) AS n FROM lab_compliance_samples WHERE voided_at IS NULL GROUP BY program, status").all<{ program: string; status: string; n: number }>(),
    db
      .prepare(
        "SELECT location, COUNT(*) AS n, SUM(moisture_pct IS NOT NULL) AS mc, SUM(water_activity IS NOT NULL) AS aw, SUM(thc_pct IS NOT NULL) AS thc FROM lab_internal_tests WHERE voided_at IS NULL AND tested_at >= ? GROUP BY location ORDER BY n DESC"
      )
      .bind(day7)
      .all<{ location: string; n: number; mc: number; aw: number; thc: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM lab_internal_tests WHERE voided_at IS NULL AND ${NEEDS_ATTENTION_SQL}`).first<{ n: number }>(),
    db.prepare("SELECT MAX(COALESCE(tested_at, created_at)) AS at FROM lab_internal_tests WHERE voided_at IS NULL").first<{ at: string | null }>(),
    db
      .prepare(
        "SELECT material_class, COUNT(*) AS n, ROUND(AVG(total_thc),2) AS avg_total_thc, MAX(total_thc) AS max_total_thc FROM lab_op_results WHERE voided_at IS NULL AND tested_at >= ? GROUP BY material_class"
      )
      .bind(day7)
      .all<{ material_class: string | null; n: number; avg_total_thc: number | null; max_total_thc: number | null }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS n, ROUND(AVG(julianday(finished_testing_on) - julianday(entered_testing_on)),1) AS avg_days FROM lab_compliance_samples WHERE voided_at IS NULL AND finished_testing_on >= ? AND entered_testing_on IS NOT NULL"
      )
      .bind(day30)
      .first<{ n: number; avg_days: number | null }>(),
    db.prepare("SELECT source_metrc_tag FROM lab_compliance_samples WHERE voided_at IS NULL AND status = 'scheduled' AND program = 'compliance'").all<{ source_metrc_tag: string }>(),
  ]);
  const tags = (readyRows.results ?? []).map((r) => r.source_metrc_tag);
  const ready = tags.length ? await readinessByTag(db, tags) : {};
  const readyCount = tags.filter((t) => ready[t] && ready[t].ready).length;
  return json({
    ok: true,
    generated_at: iso(nowMs),
    compliance: { by_status: byStatus.results ?? [], scheduled: tags.length, scheduled_ready: readyCount, turnaround_30d: turnaround },
    bench: { last_7_days_by_location: bench7.results ?? [], needs_attention: benchAttention ? benchAttention.n : 0, last_reading_at: benchLast ? benchLast.at : null },
    orange_photonics: { last_7_days_by_class: op7.results ?? [] },
  });
}

// ---------------------------------------------------------------- router

function owns(pathname: string): boolean {
  return pathname.startsWith(LAB_API_PREFIX) || LAB_FEED_PATHS.includes(pathname);
}

/** The package's router: /api/lab/* and the three feeds. Null for a path it does not own. */
export async function handleLab(request: Request, db: D1Database | null, actor: Identity | null): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  if (!owns(p)) return null;
  const m = request.method.toUpperCase();
  if (!db) return bad("db-not-bound", 500);
  try {
    if (p.startsWith("/feeds/")) {
      if (m !== "GET") return bad("method", 405);
      if (p === "/feeds/lab-internal-tests.json") return await feed(db, url, "lab_internal_tests", "lab_internal_tests");
      if (p === "/feeds/lab-compliance.json") return await feed(db, url, "lab_compliance_samples", "lab_compliance_samples");
      if (p === "/feeds/lab-op-results.json") return await feed(db, url, "lab_op_results", "lab_op_results");
      return null;
    }
    if (m !== "GET" && m !== "HEAD" && request.headers.get(CLIENT_HEADER) !== "station") return bad("client-header-required", 403);
    const rest = p.slice(LAB_API_PREFIX.length).replace(/\/+$/, "");
    const seg = rest.split("/");
    if (rest === "options" && m === "GET") return json({ ok: true, ...R.options() });
    if (rest === "me" && m === "GET") return json({ ok: true, ...labWho(actor, request.headers.get(OPERATOR_HEADER)) });
    if (rest === "summary" && m === "GET") return await summary(db);
    if (seg[0] === "internal-tests") {
      if (seg.length === 1 && m === "GET") return await listInternal(db, url);
      if (seg.length === 1 && m === "POST") return await createInternal(db, request, actor);
      if (seg.length === 2 && m === "PATCH") return await patchInternal(db, request, seg[1], actor);
      if (seg.length === 3 && seg[2] === "void" && m === "POST") return await voidRow(db, request, "lab_internal_tests", seg[1], actor);
    }
    if (seg[0] === "compliance") {
      if (seg.length === 2 && seg[1] === "metrc-autofill.csv" && m === "GET") return await autofill(db, url);
      if (seg.length === 1 && m === "GET") return await listCompliance(db, url);
      if (seg.length === 1 && m === "POST") return await createCompliance(db, request, actor);
      if (seg.length === 2 && m === "PATCH") return await patchCompliance(db, request, seg[1], actor);
      if (seg.length === 3 && seg[2] === "void" && m === "POST") return await voidRow(db, request, "lab_compliance_samples", seg[1], actor);
    }
    // No Metrc import route (law 5): POST /api/lab/metrc/import falls to not-found.
    if (seg[0] === "metrc" && seg.length === 2 && m === "GET") return await metrcLookup(db, seg[1]);
    if (seg[0] === "op") {
      if (seg.length === 2 && seg[1] === "import" && m === "POST") return await opImport(db, request, actor);
      if (seg.length === 1 && m === "GET") return await listOp(db, url);
      if (seg.length === 3 && seg[2] === "void" && m === "POST") return await voidRow(db, request, "lab_op_results", seg[1], actor, "test_id");
    }
    if (seg[0] === "schedule") {
      if (seg.length === 1 && m === "GET") return await getSchedule(db, url);
      if (seg.length === 1 && m === "PUT") return await putSchedule(db, request, actor);
    }
    return bad("not-found", 404);
  } catch (e) {
    // Named and logged, never a blank 500: the operator sees "the save did
    // not land" and the log says why.
    const err = e as { message?: unknown; stack?: unknown } | null;
    console.error("lab_tests", m, p, String((err && err.stack) || e));
    return bad("server-error", 500, { detail: String((err && err.message) || e).slice(0, 300) });
  }
}

// ---------------------------------------------------------------- the consoles' set

/** The compliance samples the consoles and the External tab read (LAB_CONSOLE_SET_SQL:
 * compliance, not voided). `status` is any spelling normalizeStatus knows (an unknown
 * word matches no row); `facility` matches testing_facility exactly. The season is
 * the caller's (console.ts sheetInSeason over harvest_batch and entered_testing_on). */
export async function listLabComplianceSurface(db: D1Database, filters: { facility?: string; status?: string } = {}): Promise<LabComplianceRow[]> {
  const where = [LAB_CONSOLE_SET_SQL];
  const binds: Cell[] = [];
  if (filters.facility) {
    where.push("testing_facility = ?");
    binds.push(filters.facility);
  }
  if (filters.status) {
    const status = R.normalizeStatus(filters.status);
    if (status === undefined) return [];
    if (status) {
      where.push("status = ?");
      binds.push(status);
    }
  }
  const got = await db
    .prepare(`SELECT * FROM lab_compliance_samples WHERE ${where.join(" AND ")} ORDER BY scheduled_at DESC, id DESC`)
    .bind(...binds)
    .all<LabComplianceRow>();
  return (got.results ?? []).map(withoutWriteId);
}
