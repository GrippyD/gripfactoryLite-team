/* All SQL lives here. Every table is schema-qualified (gripcasting.*). Shapes going out match src/shared/types.ts. */
import type { Actuals, ActualsUpload, BuildDoc, BuildItem, BuildLine, Drivers, Me, Reference, Snapshot, Submission, Tx, Upload, UserName, Vol } from "../shared/types";
import { HttpError } from "./env";
import { asSql, versionOf, type Q, type Sql, type TxSql } from "./db";


export async function currentHarvest(sql: Sql): Promise<{ id: string; code: string }> {
  const [h] = await sql<{ id: string; code: string }[]>`SELECT id, code FROM gripcasting.harvests WHERE is_current`;
  if (!h) throw new HttpError(503, "No current harvest is set up in the database yet.");
  return h;
}

export async function userByEmail(sql: Sql, email: string): Promise<Me | null> {
  const [u] = await sql<Me[]>`SELECT lower(email) AS email, name, role FROM gripcasting.app_users WHERE lower(email) = ${email} AND is_active`;
  return u || null;
}
export const users = (sql: Sql) => sql<UserName[]>`SELECT lower(email) AS email, name FROM gripcasting.app_users WHERE is_active ORDER BY name`;

export async function reference(sql: Sql, harvestId: string): Promise<Reference> {
  const [[h], bus, gls, budget] = await Promise.all([
    sql<{ code: string; wages_budget: number | null; season: Record<string, number[]>; vol_default: Vol }[]>`
      SELECT code, wages_budget, season, vol_default FROM gripcasting.harvests WHERE id = ${harvestId}`,
    sql<{ name: string }[]>`SELECT name FROM gripcasting.business_units WHERE harvest_id = ${harvestId} ORDER BY sort, code`,
    sql<{ name: string }[]>`SELECT name FROM gripcasting.gl_accounts WHERE harvest_id = ${harvestId} ORDER BY name`,
    sql<{ gl: string; bu: string; amount: number }[]>`SELECT gl, bu, amount FROM gripcasting.budget_lines WHERE harvest_id = ${harvestId}`,
  ]);
  const b: Record<string, Record<string, number>> = {};
  for (const r of budget) (b[r.gl] = b[r.gl] || {})[r.bu] = r.amount;
  return { harvest: h.code, bus: bus.map(x => x.name), gls: gls.map(x => x.name), budget: b, wagesBudget: h.wages_budget, season: h.season, volDefault: h.vol_default };
}

export async function busByCode(sql: Sql, harvestId: string): Promise<Record<string, string>> {
  const rows = await sql<{ code: string; name: string }[]>`SELECT code, name FROM gripcasting.business_units WHERE harvest_id = ${harvestId}`;
  return Object.fromEntries(rows.map(r => [r.code, r.name]));
}

/* ---------- Drivers ---------- */
export async function drivers(sql: Sql, harvestId: string): Promise<(Drivers & { version: string | null }) | null> {
  const [d] = await sql<{ vol: Vol; gl: Drivers["gl"]; updated_at: Date | null }[]>`SELECT vol, gl, updated_at FROM gripcasting.drivers WHERE harvest_id = ${harvestId}`;
  return d ? { vol: d.vol, gl: d.gl, version: versionOf(d.updated_at) } : null;
}
export async function saveDrivers(sql: Sql, harvestId: string, d: Drivers, version: string | null, email: string): Promise<string> {
  const [row] = await sql<{ updated_at: Date }[]>`
    UPDATE gripcasting.drivers SET vol = ${sql.json(d.vol as never)}, gl = ${sql.json(d.gl as never)}, updated_at = now(), updated_by = ${email}
    WHERE harvest_id = ${harvestId}
      AND (date_trunc('milliseconds', updated_at) = ${version}::timestamptz OR (updated_at IS NULL AND ${version}::timestamptz IS NULL))
    RETURNING updated_at`;
  if (row) return versionOf(row.updated_at) as string;
  const [exists] = await sql`SELECT 1 FROM gripcasting.drivers WHERE harvest_id = ${harvestId}`;
  if (exists) throw new HttpError(409, "The revenue drivers were changed by someone else. Reload to see their changes.");
  const [ins] = await sql<{ updated_at: Date }[]>`
    INSERT INTO gripcasting.drivers (harvest_id, vol, gl, updated_at, updated_by, created_by)
    VALUES (${harvestId}, ${sql.json(d.vol as never)}, ${sql.json(d.gl as never)}, now(), ${email}, ${email}) RETURNING updated_at`;
  return versionOf(ins.updated_at) as string;
}

/* ---------- Actuals ---------- */
async function closeDoc(q: Q, close: { id: string; close_date: string; file_name: string; uploaded_at: Date }): Promise<Actuals> {
  const sql = asSql(q);
  const [lines, monthly] = await Promise.all([
    sql<{ entity: string; bu: string; gl: string; amount: number }[]>`SELECT entity, bu, gl, amount FROM gripcasting.actual_lines WHERE close_id = ${close.id} ORDER BY entity, gl, bu`,
    sql<{ gl: string; month: string; amount: number }[]>`SELECT gl, to_char(month, 'YYYY-MM') AS month, amount FROM gripcasting.actual_monthly WHERE close_id = ${close.id}`,
  ]);
  const m: Actuals["monthly"] = {};
  for (const r of monthly) (m[r.gl] = m[r.gl] || {})[r.month] = r.amount;
  return { closeDate: close.close_date, fileName: close.file_name, uploadedAt: new Date(close.uploaded_at).toISOString(), rows: lines.map(r => [r.entity, r.bu, r.gl, r.amount]), monthly: m };
}
export async function actuals(sql: Sql, harvestId: string, closeDate?: string): Promise<Actuals | null> {
  const [c] = closeDate
    ? await sql<{ id: string; close_date: string; file_name: string; uploaded_at: Date }[]>`
        SELECT id, close_date::text, file_name, uploaded_at FROM gripcasting.actual_closes WHERE harvest_id = ${harvestId} AND close_date = ${closeDate}`
    : await sql<{ id: string; close_date: string; file_name: string; uploaded_at: Date }[]>`
        SELECT id, close_date::text, file_name, uploaded_at FROM gripcasting.actual_closes WHERE harvest_id = ${harvestId} AND is_current`;
  return c ? closeDoc(sql, c) : null;
}

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Load a close: replaces that close's lines, monthly totals and transactions, and makes it the current close. */
export async function saveActuals(sql: Sql, harvestId: string, a: ActualsUpload, email: string): Promise<{ actuals: Actuals; upload: Upload }> {
  return sql.begin(async (tx: TxSql) => {
    const t = asSql(tx);
    const [c] = await t<{ id: string }[]>`
      INSERT INTO gripcasting.actual_closes (harvest_id, close_date, file_name, uploaded_at, created_by)
      VALUES (${harvestId}, ${a.closeDate}, ${a.fileName}, now(), ${email})
      ON CONFLICT (harvest_id, close_date) DO UPDATE SET file_name = EXCLUDED.file_name, uploaded_at = now(), updated_at = now()
      RETURNING id`;
    await t`DELETE FROM gripcasting.actual_lines WHERE close_id = ${c.id}`;
    await t`DELETE FROM gripcasting.actual_monthly WHERE close_id = ${c.id}`;
    await t`DELETE FROM gripcasting.transactions WHERE close_id = ${c.id}`;
    for (const part of chunks(a.rows.map(([entity, bu, gl, amount]) => ({ close_id: c.id, entity, bu, gl, amount, created_by: email })), 1000))
      await t`INSERT INTO gripcasting.actual_lines ${t(part)}`;
    const monthly = Object.entries(a.monthly).flatMap(([gl, m]) => Object.entries(m).map(([k, amount]) => ({ close_id: c.id, gl, month: k + "-01", amount, created_by: email })));
    for (const part of chunks(monthly, 1000)) await t`INSERT INTO gripcasting.actual_monthly ${t(part)}`;
    const txRows = a.transactions.map(x => ({ close_id: c.id, txn_date: x.r[0], txn_type: x.r[1], num: x.r[2], vendor: x.r[3], memo: x.r[4], gl: x.r[5], bu_code: x.bu === "none" ? null : x.bu, entity: x.r[6], amount: x.r[7], created_by: email }));
    for (const part of chunks(txRows, 1000)) await t`INSERT INTO gripcasting.transactions ${t(part)}`;
    await t`UPDATE gripcasting.actual_closes SET is_current = false, updated_at = now() WHERE harvest_id = ${harvestId} AND is_current AND id <> ${c.id}`;
    await t`UPDATE gripcasting.actual_closes SET is_current = true WHERE id = ${c.id}`;
    const total = a.rows.reduce((s, r) => s + (+r[2].slice(0, 4) < 5000 ? 0 : r[3]), 0);
    const [u] = await t<{ created_at: Date }[]>`
      INSERT INTO gripcasting.upload_log (harvest_id, close_date, file_name, total, transactions, created_by)
      VALUES (${harvestId}, ${a.closeDate}, ${a.fileName}, ${Math.round(total * 100) / 100}, ${a.transactions.length}, ${email}) RETURNING created_at`;
    const [cc] = await t<{ id: string; close_date: string; file_name: string; uploaded_at: Date }[]>`
      SELECT id, close_date::text, file_name, uploaded_at FROM gripcasting.actual_closes WHERE id = ${c.id}`;
    return {
      actuals: await closeDoc(tx, cc),
      upload: { closeDate: a.closeDate, fileName: a.fileName, uploadedAt: new Date(u.created_at).toISOString(), total: Math.round(total * 100) / 100, transactions: a.transactions.length },
    };
  }) as Promise<{ actuals: Actuals; upload: Upload }>;
}

export const uploads = (sql: Sql, harvestId: string) => sql<Upload[]>`
  SELECT close_date::text AS "closeDate", file_name AS "fileName", to_json(created_at)#>>'{}' AS "uploadedAt", total, transactions
  FROM gripcasting.upload_log WHERE harvest_id = ${harvestId} ORDER BY created_at DESC LIMIT 12`;

/** Transactions from the latest close (up to the current one) that has any. */
export async function transactions(sql: Sql, harvestId: string): Promise<{ meta: { closeDate: string; fileName: string; from: string | null; to: string | null } | null; rows: Tx[] }> {
  const [c] = await sql<{ id: string; close_date: string; file_name: string; from: string | null; to: string | null }[]>`
    SELECT c.id, c.close_date::text, c.file_name, min(t.txn_date)::text AS "from", max(t.txn_date)::text AS "to"
    FROM gripcasting.actual_closes c JOIN gripcasting.transactions t ON t.close_id = c.id
    WHERE c.harvest_id = ${harvestId}
      AND c.close_date <= coalesce((SELECT close_date FROM gripcasting.actual_closes WHERE harvest_id = ${harvestId} AND is_current), 'infinity'::date)
    GROUP BY c.id ORDER BY c.close_date DESC LIMIT 1`;
  if (!c) return { meta: null, rows: [] };
  const rows = await sql<{ d: string; ty: string; num: string; vendor: string; memo: string; gl: string; entity: string; amount: number; bu: string | null }[]>`
    SELECT txn_date::text AS d, txn_type AS ty, num, vendor, memo, gl, entity, amount, bu_code AS bu
    FROM gripcasting.transactions WHERE close_id = ${c.id} ORDER BY txn_date DESC, num`;
  return { meta: { closeDate: c.close_date, fileName: c.file_name, from: c.from, to: c.to }, rows: rows.map(r => ({ bu: r.bu || "none", r: [r.d, r.ty, r.num, r.vendor, r.memo, r.gl, r.entity, r.amount] })) };
}

/* ---------- Builds ---------- */
interface LineRow { build_code: string; gl: string; status: BuildLine["status"]; reason: string; is_custom: boolean; edited_at: Date | null; edited_by: string | null; line_id: string }
interface ItemRow { line_id: string; client_id: string; description: string; po: string; driver: BuildItem["drv"] | null; share: number | null; per_hour: number | null; qty: number | null; unit: string; unit_cost: number | null; start_on: string | null; end_on: string | null }

function toItem(r: ItemRow): BuildItem {
  const it: BuildItem = { id: r.client_id };
  if (r.description) it.desc = r.description; if (r.po) it.po = r.po; if (r.driver) it.drv = r.driver;
  if (r.share != null) it.share = r.share; if (r.per_hour != null) it.per = r.per_hour; if (r.qty != null) it.qty = r.qty;
  if (r.unit) it.unit = r.unit; if (r.unit_cost != null) it.cost = r.unit_cost; if (r.start_on) it.start = r.start_on; if (r.end_on) it.end = r.end_on;
  return it;
}

export async function builds(q: Q, harvestId: string, code?: string): Promise<Record<string, BuildDoc>> {
  const sql = asSql(q);
  const filter = code ? sql`AND b.bu_code = ${code}` : sql``;
  const [heads, lines, items] = await Promise.all([
    sql<{ code: string; bu: string | null; submitted_at: Date | null; submitted_by: string | null; updated_at: Date | null }[]>`
      SELECT b.bu_code AS code, u.name AS bu, b.submitted_at, b.submitted_by, b.updated_at
      FROM gripcasting.builds b LEFT JOIN gripcasting.business_units u ON u.harvest_id = b.harvest_id AND u.code = b.bu_code
      WHERE b.harvest_id = ${harvestId} ${filter}`,
    sql<LineRow[]>`
      SELECT b.bu_code AS build_code, l.id AS line_id, l.gl, l.status, l.reason, l.is_custom, l.edited_at, l.edited_by
      FROM gripcasting.build_lines l JOIN gripcasting.builds b ON b.id = l.build_id WHERE b.harvest_id = ${harvestId} ${filter}`,
    sql<ItemRow[]>`
      SELECT i.line_id, i.client_id, i.description, i.po, i.driver, i.share, i.per_hour, i.qty, i.unit, i.unit_cost, i.start_on::text, i.end_on::text
      FROM gripcasting.build_items i JOIN gripcasting.build_lines l ON l.id = i.line_id JOIN gripcasting.builds b ON b.id = l.build_id
      WHERE b.harvest_id = ${harvestId} ${filter} ORDER BY i.sort`,
  ]);
  const out: Record<string, BuildDoc> = {}, byLine: Record<string, BuildItem[]> = {};
  for (const i of items) (byLine[i.line_id] = byLine[i.line_id] || []).push(toItem(i));
  for (const h of heads) out[h.code] = { bu: h.bu || h.code, lines: {}, submittedAt: h.submitted_at ? new Date(h.submitted_at).toISOString() : null, submittedBy: h.submitted_by, version: versionOf(h.updated_at) };
  for (const l of lines) {
    const ln: BuildLine = { status: l.status, items: byLine[l.line_id] || [] };
    if (l.reason) ln.reason = l.reason; if (l.is_custom) ln.custom = true;
    if (l.edited_at) ln.updatedAt = new Date(l.edited_at).toISOString(); if (l.edited_by) ln.updatedBy = l.edited_by;
    out[l.build_code].lines[l.gl] = ln;
  }
  return out;
}

const lineKey = (l: BuildLine) => JSON.stringify([l.status, l.reason || "", !!l.custom, l.items]);

/** Save a BU's build. Locks on builds.updated_at; stamps edited_at/by only on lines whose content changed. */
export async function saveBuild(sql: Sql, harvestId: string, code: string, doc: BuildDoc, version: string | null, email: string): Promise<BuildDoc> {
  await sql.begin(async (tx: TxSql) => {
    const t = asSql(tx);
    const [b] = await t<{ id: string; updated_at: Date | null }[]>`
      SELECT id, updated_at FROM gripcasting.builds WHERE harvest_id = ${harvestId} AND bu_code = ${code} FOR UPDATE`;
    let buildId: string;
    if (!b) {
      if (version) throw new HttpError(409, "This forecast was changed by someone else. Reload to see their changes.");
      const [ins] = await t<{ id: string }[]>`INSERT INTO gripcasting.builds (harvest_id, bu_code, created_by) VALUES (${harvestId}, ${code}, ${email}) RETURNING id`;
      buildId = ins.id;
    } else {
      const [ok] = await t`
        SELECT 1 FROM gripcasting.builds WHERE id = ${b.id}
          AND (date_trunc('milliseconds', updated_at) = ${version}::timestamptz OR (updated_at IS NULL AND ${version}::timestamptz IS NULL))`;
      if (!ok) throw new HttpError(409, "This forecast was changed by someone else. Reload to see their changes.");
      buildId = b.id;
    }
    const old = (await builds(tx, harvestId, code))[code]?.lines || {};
    await t`DELETE FROM gripcasting.build_lines WHERE build_id = ${buildId}`;
    for (const [gl, ln] of Object.entries(doc.lines)) {
      const prev = old[gl], same = prev && lineKey(prev) === lineKey(ln);
      const editedAt = same ? prev.updatedAt || null : new Date().toISOString(), editedBy = same ? prev.updatedBy || null : email;
      const [l] = await t<{ id: string }[]>`
        INSERT INTO gripcasting.build_lines (build_id, gl, status, reason, is_custom, edited_at, edited_by, created_by)
        VALUES (${buildId}, ${gl}, ${ln.status}, ${ln.reason || ""}, ${!!ln.custom}, ${editedAt}::timestamptz, ${editedBy}, ${email}) RETURNING id`;
      const rows = ln.items.map((it, i) => ({
        line_id: l.id, client_id: it.id, sort: i, description: it.desc || "", po: it.po || "", driver: it.drv || null,
        share: it.share ?? null, per_hour: it.per ?? null, qty: it.qty ?? null, unit: it.unit || "", unit_cost: it.cost ?? null,
        start_on: it.start || (it.month ? it.month + "-01" : null),
        end_on: it.end || (it.month ? lastDay(it.month) : null), created_by: email,
      }));
      for (const part of chunks(rows, 500)) await t`INSERT INTO gripcasting.build_items ${t(part)}`;
    }
    await t`UPDATE gripcasting.builds SET updated_at = now(), updated_by = ${email} WHERE id = ${buildId}`;
  });
  return (await builds(sql, harvestId, code))[code];
}
const lastDay = (ym: string) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m, 0)); return d.toISOString().slice(0, 10); };

/* ---------- Submissions ---------- */
interface SubRow { id: string; kind: "bu" | "final"; bu_code: string | null; bu: string | null; close_date: string | null; created_at: Date; created_by: string; budget: number; actual: number; remaining: number; landing: number; variance: number; revenue: number | null; ebitda: number | null; bu_subs: Record<string, string> | null }
const toSub = (r: SubRow): Submission => ({
  id: r.id, kind: r.kind, code: r.bu_code, bu: r.kind === "final" ? "All BUs" : (r.bu || r.bu_code || ""), closeDate: r.close_date,
  submittedAt: new Date(r.created_at).toISOString(), submittedBy: r.created_by,
  totals: { b: r.budget, a: r.actual, rem: r.remaining, landing: r.landing, varc: r.variance, ...(r.revenue != null ? { revenue: r.revenue } : {}), ...(r.ebitda != null ? { ebitda: r.ebitda } : {}) },
  ...(r.bu_subs ? { buSubs: r.bu_subs } : {}),
});
export async function submissions(sql: Sql, harvestId: string): Promise<Submission[]> {
  const rows = await sql<SubRow[]>`
    SELECT s.id, s.kind, s.bu_code, u.name AS bu, s.close_date::text, s.created_at, s.created_by, s.budget, s.actual, s.remaining, s.landing, s.variance, s.revenue, s.ebitda, s.bu_subs
    FROM gripcasting.submissions s LEFT JOIN gripcasting.business_units u ON u.harvest_id = s.harvest_id AND u.code = s.bu_code
    WHERE s.harvest_id = ${harvestId} ORDER BY s.created_at DESC`;
  return rows.map(toSub);
}
export async function addSubmission(sql: Sql, harvestId: string, s: { kind: "bu" | "final"; code: string | null; closeDate: string | null; totals: Submission["totals"]; buSubs: Record<string, string> | null; snapshot: Snapshot }, email: string): Promise<Submission> {
  return sql.begin(async (tx: TxSql) => {
    const t = asSql(tx);
    const [r] = await t<{ id: string }[]>`
      INSERT INTO gripcasting.submissions (harvest_id, kind, bu_code, close_date, budget, actual, remaining, landing, variance, revenue, ebitda, bu_subs, snapshot, created_by)
      VALUES (${harvestId}, ${s.kind}, ${s.code}, ${s.closeDate}, ${s.totals.b}, ${s.totals.a}, ${s.totals.rem}, ${s.totals.landing}, ${s.totals.varc},
              ${s.totals.revenue ?? null}, ${s.totals.ebitda ?? null}, ${s.buSubs ? t.json(s.buSubs) : null}, ${t.json(s.snapshot as never)}, ${email})
      RETURNING id`;
    if (s.kind === "bu" && s.code) await t`
      INSERT INTO gripcasting.builds (harvest_id, bu_code, submitted_at, submitted_by, created_by) VALUES (${harvestId}, ${s.code}, now(), ${email}, ${email})
      ON CONFLICT (harvest_id, bu_code) DO UPDATE SET submitted_at = now(), submitted_by = ${email}`;
    const [row] = await t<SubRow[]>`
      SELECT s.id, s.kind, s.bu_code, u.name AS bu, s.close_date::text, s.created_at, s.created_by, s.budget, s.actual, s.remaining, s.landing, s.variance, s.revenue, s.ebitda, s.bu_subs
      FROM gripcasting.submissions s LEFT JOIN gripcasting.business_units u ON u.harvest_id = s.harvest_id AND u.code = s.bu_code WHERE s.id = ${r.id}`;
    return toSub(row);
  }) as Promise<Submission>;
}
export async function snapshot(sql: Sql, harvestId: string, id: string): Promise<Snapshot | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await sql<{ snapshot: Snapshot }[]>`SELECT snapshot FROM gripcasting.submissions WHERE id = ${id} AND harvest_id = ${harvestId}`;
  return r ? r.snapshot : null;
}
