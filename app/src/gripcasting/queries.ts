/* GRIPCasting SQL on D1. Shapes going out match the finance model: dollars on
 * the wire, integer cents and rate scales in the tables. Multi-statement
 * writes go through db.batch. Each statement stays at or under 100 binds. */
import { nowIso } from "../audit";
import { HttpError } from "./http";
import { cents, dollars, fromMillionths, fromTenThousandths, millionths, tenThousandths } from "./money";
import type {
  Actuals,
  ActualsUpload,
  BuildDoc,
  BuildItem,
  BuildLine,
  Drivers,
  Me,
  Reference,
  Snapshot,
  StatePayload,
  Submission,
  Tx,
  Upload,
  UserName,
  Vol,
} from "./types";

type Bind = string | number | null;
const MAX_PARAMS = 100;

export function insertStmts(db: D1Database, table: string, columns: string[], rows: Bind[][]): D1PreparedStatement[] {
  if (rows.length === 0) return [];
  const per = Math.max(1, Math.floor(MAX_PARAMS / columns.length));
  const one = `(${columns.map(() => "?").join(", ")})`;
  const head = `INSERT INTO ${table} (${columns.join(", ")}) VALUES `;
  const out: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += per) {
    const part = rows.slice(i, i + per);
    out.push(db.prepare(head + part.map(() => one).join(", ")).bind(...part.flat()));
  }
  return out;
}

/** D1 batches are one transaction each. Keep them short of the platform cap. */
export async function runBatch(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  const size = 80;
  for (let i = 0; i < stmts.length; i += size) {
    const part = stmts.slice(i, i + size);
    if (part.length) await db.batch(part);
  }
}

function asJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  if (typeof raw === "string") return JSON.parse(raw) as T;
  return raw as T;
}

function isoOf(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

function versionOf(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function versionMatches(stored: string | null, version: string | null): boolean {
  if (version == null) return stored == null;
  if (stored == null) return false;
  if (stored === version) return true;
  const a = Date.parse(stored);
  const b = Date.parse(version);
  return Number.isFinite(a) && a === b;
}

const nid = () => crypto.randomUUID();

export async function currentHarvest(db: D1Database): Promise<{ id: string; code: string }> {
  const h = await db.prepare(`SELECT id, code FROM gc_harvests WHERE is_current = 1`).first<{ id: string; code: string }>();
  if (!h) throw new HttpError(503, "No current harvest is set up in the database yet.");
  return h;
}

export async function userByEmail(db: D1Database, email: string): Promise<Me | null> {
  const u = await db.prepare(
    `SELECT lower(email) AS email, name, role FROM gc_app_users WHERE lower(email) = ? AND is_active = 1`
  ).bind(email.trim().toLowerCase()).first<Me>();
  return u ?? null;
}

export async function users(db: D1Database): Promise<UserName[]> {
  const rows = await db.prepare(
    `SELECT lower(email) AS email, name FROM gc_app_users WHERE is_active = 1 ORDER BY name`
  ).all<UserName>();
  return rows.results;
}

type HarvestRefRow = { code: string; wages_budget: number | null; season: string; vol_default: string };

export async function reference(db: D1Database, harvestId: string): Promise<Reference> {
  const [h, bus, gls, budget] = await Promise.all([
    db.prepare(`SELECT code, wages_budget, season, vol_default FROM gc_harvests WHERE id = ?`).bind(harvestId).first<HarvestRefRow>(),
    db.prepare(`SELECT name FROM gc_business_units WHERE harvest_id = ? ORDER BY sort, code`).bind(harvestId).all<{ name: string }>(),
    db.prepare(`SELECT name FROM gc_gl_accounts WHERE harvest_id = ? ORDER BY name`).bind(harvestId).all<{ name: string }>(),
    db.prepare(`SELECT gl, bu, amount FROM gc_budget_lines WHERE harvest_id = ?`).bind(harvestId).all<{ gl: string; bu: string; amount: number }>(),
  ]);
  if (!h) throw new HttpError(503, "No current harvest is set up in the database yet.");
  const b: Record<string, Record<string, number>> = {};
  for (const r of budget.results) (b[r.gl] = b[r.gl] || {})[r.bu] = dollars(r.amount);
  return {
    harvest: h.code,
    bus: bus.results.map((x) => x.name),
    gls: gls.results.map((x) => x.name),
    budget: b,
    wagesBudget: h.wages_budget == null ? null : dollars(h.wages_budget),
    season: asJson(h.season, {}),
    volDefault: asJson<Vol>(h.vol_default, {} as Vol),
  };
}

export async function busByCode(db: D1Database, harvestId: string): Promise<Record<string, string>> {
  const rows = await db.prepare(`SELECT code, name FROM gc_business_units WHERE harvest_id = ?`).bind(harvestId).all<{ code: string; name: string }>();
  return Object.fromEntries(rows.results.map((r) => [r.code, r.name]));
}

export async function drivers(db: D1Database, harvestId: string): Promise<(Drivers & { version: string | null }) | null> {
  const d = await db.prepare(`SELECT vol, gl, updated_at FROM gc_drivers WHERE harvest_id = ?`).bind(harvestId).first<{ vol: string; gl: string; updated_at: string | null }>();
  return d ? { vol: asJson<Vol>(d.vol, {} as Vol), gl: asJson(d.gl, {}), version: versionOf(d.updated_at) } : null;
}

export async function saveDrivers(db: D1Database, harvestId: string, d: Drivers, version: string | null, email: string): Promise<string> {
  const now = nowIso();
  const vol = JSON.stringify(d.vol);
  const gl = JSON.stringify(d.gl);
  const upd = await db.prepare(
    `UPDATE gc_drivers SET vol = ?, gl = ?, updated_at = ?, updated_by = ?
     WHERE harvest_id = ? AND ((updated_at = ? AND ? IS NOT NULL) OR (updated_at IS NULL AND ? IS NULL))`
  ).bind(vol, gl, now, email, harvestId, version, version, version).run();
  if (Number(upd.meta?.changes ?? 0) > 0) return now;
  const exists = await db.prepare(`SELECT id FROM gc_drivers WHERE harvest_id = ?`).bind(harvestId).first();
  if (exists) throw new HttpError(409, "The revenue drivers were changed by someone else. Reload to see their changes.");
  await db.prepare(
    `INSERT INTO gc_drivers (id, harvest_id, vol, gl, updated_at, updated_by, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(nid(), harvestId, vol, gl, now, email, now, email).run();
  return now;
}

type CloseRow = { id: string; close_date: string; file_name: string; uploaded_at: string };

async function closeDoc(db: D1Database, close: CloseRow): Promise<Actuals> {
  const [lines, monthly] = await Promise.all([
    db.prepare(`SELECT entity, bu, gl, amount FROM gc_actual_lines WHERE close_id = ? ORDER BY entity, gl, bu`).bind(close.id).all<{ entity: string; bu: string; gl: string; amount: number }>(),
    db.prepare(`SELECT gl, month, amount FROM gc_actual_monthly WHERE close_id = ?`).bind(close.id).all<{ gl: string; month: string; amount: number }>(),
  ]);
  const m: Actuals["monthly"] = {};
  for (const r of monthly.results) (m[r.gl] = m[r.gl] || {})[String(r.month).slice(0, 7)] = dollars(r.amount);
  return {
    closeDate: close.close_date,
    fileName: close.file_name,
    uploadedAt: isoOf(close.uploaded_at),
    rows: lines.results.map((r) => [r.entity, r.bu, r.gl, dollars(r.amount)]),
    monthly: m,
  };
}

export async function actuals(db: D1Database, harvestId: string, closeDate?: string): Promise<Actuals | null> {
  const c = closeDate
    ? await db.prepare(`SELECT id, close_date, file_name, uploaded_at FROM gc_actual_closes WHERE harvest_id = ? AND close_date = ?`).bind(harvestId, closeDate).first<CloseRow>()
    : await db.prepare(`SELECT id, close_date, file_name, uploaded_at FROM gc_actual_closes WHERE harvest_id = ? AND is_current = 1`).bind(harvestId).first<CloseRow>();
  return c ? closeDoc(db, c) : null;
}

export async function saveActuals(db: D1Database, harvestId: string, a: ActualsUpload, email: string): Promise<{ actuals: Actuals; upload: Upload }> {
  const now = nowIso();
  const existing = await db.prepare(`SELECT id FROM gc_actual_closes WHERE harvest_id = ? AND close_date = ?`).bind(harvestId, a.closeDate).first<{ id: string }>();
  const closeId = existing?.id ?? nid();
  const stmts: D1PreparedStatement[] = [];
  if (existing) {
    stmts.push(db.prepare(
      `UPDATE gc_actual_closes SET file_name = ?, uploaded_at = ?, updated_at = ?, is_current = 0 WHERE id = ?`
    ).bind(a.fileName, now, now, closeId));
  } else {
    stmts.push(db.prepare(
      `INSERT INTO gc_actual_closes (id, harvest_id, close_date, file_name, uploaded_at, is_current, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(closeId, harvestId, a.closeDate, a.fileName, now, now, email));
  }
  stmts.push(db.prepare(`DELETE FROM gc_actual_lines WHERE close_id = ?`).bind(closeId));
  stmts.push(db.prepare(`DELETE FROM gc_actual_monthly WHERE close_id = ?`).bind(closeId));
  stmts.push(db.prepare(`DELETE FROM gc_transactions WHERE close_id = ?`).bind(closeId));
  stmts.push(...insertStmts(db, "gc_actual_lines",
    ["id", "close_id", "entity", "bu", "gl", "amount", "created_at", "updated_at", "created_by"],
    a.rows.map(([entity, bu, gl, amount]) => [nid(), closeId, entity, bu, gl, cents(amount), now, null, email])));
  const monthly: Bind[][] = [];
  for (const [gl, months] of Object.entries(a.monthly)) {
    for (const [k, amount] of Object.entries(months)) monthly.push([nid(), closeId, gl, `${k}-01`, cents(amount), now, null, email]);
  }
  stmts.push(...insertStmts(db, "gc_actual_monthly",
    ["id", "close_id", "gl", "month", "amount", "created_at", "updated_at", "created_by"],
    monthly));
  stmts.push(...insertStmts(db, "gc_transactions",
    ["id", "close_id", "txn_date", "txn_type", "num", "vendor", "memo", "gl", "bu_code", "entity", "amount", "created_at", "updated_at", "created_by"],
    a.transactions.map((x) => [
      nid(), closeId, x.r[0], x.r[1], x.r[2], x.r[3], x.r[4], x.r[5], x.bu === "none" ? null : x.bu, x.r[6], cents(x.r[7]), now, null, email,
    ])));
  stmts.push(db.prepare(
    `UPDATE gc_actual_closes SET is_current = 0, updated_at = ? WHERE harvest_id = ? AND is_current = 1 AND id <> ?`
  ).bind(now, harvestId, closeId));
  stmts.push(db.prepare(`UPDATE gc_actual_closes SET is_current = 1 WHERE id = ?`).bind(closeId));
  const total = Math.round(a.rows.reduce((s, r) => s + (+r[2].slice(0, 4) < 5000 ? 0 : r[3]), 0) * 100) / 100;
  stmts.push(db.prepare(
    `INSERT INTO gc_upload_log (id, harvest_id, close_date, file_name, total, transactions, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(nid(), harvestId, a.closeDate, a.fileName, cents(total), a.transactions.length, now, email));
  await runBatch(db, stmts);
  return {
    actuals: await closeDoc(db, { id: closeId, close_date: a.closeDate, file_name: a.fileName, uploaded_at: now }),
    upload: { closeDate: a.closeDate, fileName: a.fileName, uploadedAt: now, total, transactions: a.transactions.length },
  };
}

export async function uploads(db: D1Database, harvestId: string): Promise<Upload[]> {
  const rows = await db.prepare(
    `SELECT close_date AS closeDate, file_name AS fileName, created_at AS uploadedAt, total, transactions
     FROM gc_upload_log WHERE harvest_id = ? ORDER BY created_at DESC LIMIT 12`
  ).bind(harvestId).all<{ closeDate: string; fileName: string; uploadedAt: string; total: number; transactions: number }>();
  return rows.results.map((r) => ({ ...r, uploadedAt: isoOf(r.uploadedAt), total: dollars(r.total) }));
}

export async function transactions(db: D1Database, harvestId: string): Promise<{ meta: { closeDate: string; fileName: string; from: string | null; to: string | null } | null; rows: Tx[] }> {
  const c = await db.prepare(
    `SELECT c.id, c.close_date, c.file_name
     FROM gc_actual_closes c
     WHERE c.harvest_id = ?
       AND EXISTS (SELECT 1 FROM gc_transactions t WHERE t.close_id = c.id)
       AND c.close_date <= COALESCE((SELECT close_date FROM gc_actual_closes WHERE harvest_id = ? AND is_current = 1), '9999-12-31')
     ORDER BY c.close_date DESC LIMIT 1`
  ).bind(harvestId, harvestId).first<{ id: string; close_date: string; file_name: string }>();
  if (!c) return { meta: null, rows: [] };
  const [span, rows] = await Promise.all([
    db.prepare(`SELECT MIN(txn_date) AS dfrom, MAX(txn_date) AS dto FROM gc_transactions WHERE close_id = ?`).bind(c.id).first<{ dfrom: string | null; dto: string | null }>(),
    db.prepare(
      `SELECT txn_date AS d, txn_type AS ty, num, vendor, memo, gl, entity, amount, bu_code AS bu
       FROM gc_transactions WHERE close_id = ? ORDER BY txn_date DESC, num`
    ).bind(c.id).all<{ d: string; ty: string; num: string; vendor: string; memo: string; gl: string; entity: string; amount: number; bu: string | null }>(),
  ]);
  return {
    meta: { closeDate: c.close_date, fileName: c.file_name, from: span?.dfrom ?? null, to: span?.dto ?? null },
    rows: rows.results.map((r) => ({ bu: r.bu || "none", r: [r.d, r.ty, r.num, r.vendor, r.memo, r.gl, r.entity, dollars(r.amount)] })),
  };
}

interface LineRow {
  build_code: string;
  gl: string;
  status: BuildLine["status"];
  reason: string;
  is_custom: number;
  edited_at: string | null;
  edited_by: string | null;
  line_id: string;
}
interface ItemRow {
  line_id: string;
  client_id: string;
  description: string;
  po: string;
  driver: BuildItem["drv"] | null;
  share: number | null;
  per_hour: number | null;
  qty: number | null;
  unit: string;
  unit_cost: number | null;
  start_on: string | null;
  end_on: string | null;
}

function toItem(r: ItemRow): BuildItem {
  const it: BuildItem = { id: r.client_id };
  if (r.description) it.desc = r.description;
  if (r.po) it.po = r.po;
  if (r.driver) it.drv = r.driver;
  if (r.share != null) it.share = fromMillionths(r.share);
  if (r.per_hour != null) it.per = fromTenThousandths(r.per_hour);
  if (r.qty != null) it.qty = fromTenThousandths(r.qty);
  if (r.unit) it.unit = r.unit;
  if (r.unit_cost != null) it.cost = fromTenThousandths(r.unit_cost);
  if (r.start_on) it.start = r.start_on;
  if (r.end_on) it.end = r.end_on;
  return it;
}

export async function builds(db: D1Database, harvestId: string, code?: string): Promise<Record<string, BuildDoc>> {
  const headSql = code
    ? `SELECT b.bu_code AS code, u.name AS bu, b.submitted_at, b.submitted_by, b.updated_at
       FROM gc_builds b LEFT JOIN gc_business_units u ON u.harvest_id = b.harvest_id AND u.code = b.bu_code
       WHERE b.harvest_id = ? AND b.bu_code = ?`
    : `SELECT b.bu_code AS code, u.name AS bu, b.submitted_at, b.submitted_by, b.updated_at
       FROM gc_builds b LEFT JOIN gc_business_units u ON u.harvest_id = b.harvest_id AND u.code = b.bu_code
       WHERE b.harvest_id = ?`;
  const lineSql = code
    ? `SELECT b.bu_code AS build_code, l.id AS line_id, l.gl, l.status, l.reason, l.is_custom, l.edited_at, l.edited_by
       FROM gc_build_lines l JOIN gc_builds b ON b.id = l.build_id WHERE b.harvest_id = ? AND b.bu_code = ?`
    : `SELECT b.bu_code AS build_code, l.id AS line_id, l.gl, l.status, l.reason, l.is_custom, l.edited_at, l.edited_by
       FROM gc_build_lines l JOIN gc_builds b ON b.id = l.build_id WHERE b.harvest_id = ?`;
  const itemSql = code
    ? `SELECT i.line_id, i.client_id, i.description, i.po, i.driver, i.share, i.per_hour, i.qty, i.unit, i.unit_cost, i.start_on, i.end_on
       FROM gc_build_items i JOIN gc_build_lines l ON l.id = i.line_id JOIN gc_builds b ON b.id = l.build_id
       WHERE b.harvest_id = ? AND b.bu_code = ? ORDER BY i.sort`
    : `SELECT i.line_id, i.client_id, i.description, i.po, i.driver, i.share, i.per_hour, i.qty, i.unit, i.unit_cost, i.start_on, i.end_on
       FROM gc_build_items i JOIN gc_build_lines l ON l.id = i.line_id JOIN gc_builds b ON b.id = l.build_id
       WHERE b.harvest_id = ? ORDER BY i.sort`;
  const binds = code ? [harvestId, code] : [harvestId];
  const [heads, lines, items] = await Promise.all([
    db.prepare(headSql).bind(...binds).all<{ code: string; bu: string | null; submitted_at: string | null; submitted_by: string | null; updated_at: string | null }>(),
    db.prepare(lineSql).bind(...binds).all<LineRow>(),
    db.prepare(itemSql).bind(...binds).all<ItemRow>(),
  ]);
  const out: Record<string, BuildDoc> = {};
  const byLine: Record<string, BuildItem[]> = {};
  for (const i of items.results) (byLine[i.line_id] = byLine[i.line_id] || []).push(toItem(i));
  for (const h of heads.results) {
    out[h.code] = {
      bu: h.bu || h.code,
      lines: {},
      submittedAt: h.submitted_at ? isoOf(h.submitted_at) : null,
      submittedBy: h.submitted_by,
      version: versionOf(h.updated_at),
    };
  }
  for (const l of lines.results) {
    const ln: BuildLine = { status: l.status, items: byLine[l.line_id] || [] };
    if (l.reason) ln.reason = l.reason;
    if (l.is_custom) ln.custom = true;
    if (l.edited_at) ln.updatedAt = isoOf(l.edited_at);
    if (l.edited_by) ln.updatedBy = l.edited_by;
    out[l.build_code].lines[l.gl] = ln;
  }
  return out;
}

const lineKey = (l: BuildLine) => JSON.stringify([l.status, l.reason || "", !!l.custom, l.items]);
const lastDay = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

export async function saveBuild(db: D1Database, harvestId: string, code: string, doc: BuildDoc, version: string | null, email: string): Promise<BuildDoc> {
  const head = await db.prepare(`SELECT id, updated_at FROM gc_builds WHERE harvest_id = ? AND bu_code = ?`).bind(harvestId, code).first<{ id: string; updated_at: string | null }>();
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  let buildId: string;
  if (!head) {
    if (version) throw new HttpError(409, "This forecast was changed by someone else. Reload to see their changes.");
    buildId = nid();
    stmts.push(db.prepare(
      `INSERT INTO gc_builds (id, harvest_id, bu_code, created_at, created_by) VALUES (?, ?, ?, ?, ?)`
    ).bind(buildId, harvestId, code, now, email));
  } else if (!versionMatches(versionOf(head.updated_at), version)) {
    throw new HttpError(409, "This forecast was changed by someone else. Reload to see their changes.");
  } else {
    buildId = head.id;
  }
  const old = (await builds(db, harvestId, code))[code]?.lines || {};
  stmts.push(db.prepare(`DELETE FROM gc_build_items WHERE line_id IN (SELECT id FROM gc_build_lines WHERE build_id = ?)`).bind(buildId));
  stmts.push(db.prepare(`DELETE FROM gc_build_lines WHERE build_id = ?`).bind(buildId));
  const itemCols = ["id", "line_id", "client_id", "sort", "description", "po", "driver", "share", "per_hour", "qty", "unit", "unit_cost", "start_on", "end_on", "created_at", "updated_at", "created_by"];
  for (const [gl, ln] of Object.entries(doc.lines)) {
    const prev = old[gl];
    const same = !!(prev && lineKey(prev) === lineKey(ln));
    const editedAt = same ? prev.updatedAt || null : now;
    const editedBy = same ? prev.updatedBy || null : email;
    const lineId = nid();
    stmts.push(db.prepare(
      `INSERT INTO gc_build_lines (id, build_id, gl, status, reason, is_custom, edited_at, edited_by, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(lineId, buildId, gl, ln.status, ln.reason || "", ln.custom ? 1 : 0, editedAt, editedBy, now, email));
    stmts.push(...insertStmts(db, "gc_build_items", itemCols, ln.items.map((it, i) => [
      nid(), lineId, it.id, i, it.desc || "", it.po || "", it.drv || null,
      it.share == null ? null : millionths(it.share),
      it.per == null ? null : tenThousandths(it.per),
      it.qty == null ? null : tenThousandths(it.qty),
      it.unit || "",
      it.cost == null ? null : tenThousandths(it.cost),
      it.start || (it.month ? `${it.month}-01` : null),
      it.end || (it.month ? lastDay(it.month) : null),
      now, null, email,
    ])));
  }
  stmts.push(db.prepare(`UPDATE gc_builds SET updated_at = ?, updated_by = ? WHERE id = ?`).bind(now, email, buildId));
  await runBatch(db, stmts);
  const saved = (await builds(db, harvestId, code))[code];
  if (!saved) throw new Error("build missing after save");
  return saved;
}

interface SubRow {
  id: string;
  kind: "bu" | "final";
  bu_code: string | null;
  bu: string | null;
  close_date: string | null;
  created_at: string;
  created_by: string;
  budget: number;
  actual: number;
  remaining: number;
  landing: number;
  variance: number;
  revenue: number | null;
  ebitda: number | null;
  bu_subs: string | null;
}

const SUB_SQL = `SELECT s.id, s.kind, s.bu_code, u.name AS bu, s.close_date, s.created_at, s.created_by,
  s.budget, s.actual, s.remaining, s.landing, s.variance, s.revenue, s.ebitda, s.bu_subs
  FROM gc_submissions s LEFT JOIN gc_business_units u ON u.harvest_id = s.harvest_id AND u.code = s.bu_code`;

function toSub(r: SubRow): Submission {
  const buSubs = r.bu_subs ? asJson<Record<string, string>>(r.bu_subs, {}) : null;
  return {
    id: r.id,
    kind: r.kind,
    code: r.bu_code,
    bu: r.kind === "final" ? "All BUs" : (r.bu || r.bu_code || ""),
    closeDate: r.close_date,
    submittedAt: isoOf(r.created_at),
    submittedBy: r.created_by,
    totals: {
      b: dollars(r.budget),
      a: dollars(r.actual),
      rem: dollars(r.remaining),
      landing: dollars(r.landing),
      varc: dollars(r.variance),
      ...(r.revenue != null ? { revenue: dollars(r.revenue) } : {}),
      ...(r.ebitda != null ? { ebitda: dollars(r.ebitda) } : {}),
    },
    ...(buSubs ? { buSubs } : {}),
  };
}

export async function submissions(db: D1Database, harvestId: string): Promise<Submission[]> {
  const rows = await db.prepare(`${SUB_SQL} WHERE s.harvest_id = ? ORDER BY s.created_at DESC`).bind(harvestId).all<SubRow>();
  return rows.results.map(toSub);
}

export async function addSubmission(
  db: D1Database,
  harvestId: string,
  s: { kind: "bu" | "final"; code: string | null; closeDate: string | null; totals: Submission["totals"]; buSubs: Record<string, string> | null; snapshot: Snapshot },
  email: string
): Promise<Submission> {
  const now = nowIso();
  const id = nid();
  const stmts: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO gc_submissions (
         id, harvest_id, kind, bu_code, close_date, budget, actual, remaining, landing, variance, revenue, ebitda, bu_subs, snapshot, created_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, harvestId, s.kind, s.code, s.closeDate,
      cents(s.totals.b), cents(s.totals.a), cents(s.totals.rem), cents(s.totals.landing), cents(s.totals.varc),
      s.totals.revenue == null ? null : cents(s.totals.revenue),
      s.totals.ebitda == null ? null : cents(s.totals.ebitda),
      s.buSubs ? JSON.stringify(s.buSubs) : null,
      JSON.stringify(s.snapshot),
      now, email
    ),
  ];
  if (s.kind === "bu" && s.code) {
    stmts.push(db.prepare(
      `INSERT INTO gc_builds (id, harvest_id, bu_code, submitted_at, submitted_by, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(harvest_id, bu_code) DO UPDATE SET submitted_at = excluded.submitted_at, submitted_by = excluded.submitted_by`
    ).bind(nid(), harvestId, s.code, now, email, now, email));
  }
  await runBatch(db, stmts);
  const row = await db.prepare(`${SUB_SQL} WHERE s.id = ?`).bind(id).first<SubRow>();
  if (!row) throw new Error("submission missing after save");
  return toSub(row);
}

export async function snapshot(db: D1Database, harvestId: string, id: string): Promise<Snapshot | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await db.prepare(`SELECT snapshot FROM gc_submissions WHERE id = ? AND harvest_id = ?`).bind(id, harvestId).first<{ snapshot: string }>();
  return r ? asJson<Snapshot>(r.snapshot, { drivers: { vol: {} as Vol, gl: {} }, builds: {} }) : null;
}

/** One parallel round of the indexed reads the state page needs. */
export async function loadState(db: D1Database, harvestId: string): Promise<StatePayload> {
  const [driverRows, actual, buildRows, uploadRows, submissionRows, userRows] = await Promise.all([
    drivers(db, harvestId),
    actuals(db, harvestId),
    builds(db, harvestId),
    uploads(db, harvestId),
    submissions(db, harvestId),
    users(db),
  ]);
  return { drivers: driverRows, actuals: actual, builds: buildRows, uploads: uploadRows, submissions: submissionRows, users: userRows };
}
