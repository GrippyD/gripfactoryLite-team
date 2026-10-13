/* /api/* routes. Every request: identity from the edge -> active app user -> role check on the server.
   Roles: admin (finance) loads actuals, sets drivers, makes the final submission; director edits and submits builds.
   Both read everything (directors see all BUs' transactions by decision). */
import type { Me, Snapshot, SubmissionIn } from "../shared/types";
import { BU_BY_CODE, buLines, compute, initReference, mergeDrivers, registerActualGLs, registerBuildGLs, round2 } from "../shared/model";
import { identity } from "./auth";
import { connect, type Sql } from "./db";
import { HttpError, type Env } from "./env";
import * as q from "./queries";
import * as v from "./validate";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const need = (ok: boolean, msg = "You don't have permission to do that.") => { if (!ok) throw new HttpError(403, msg); };
async function body(req: Request): Promise<unknown> { try { return await req.json(); } catch { throw new HttpError(400, "The request body isn't valid JSON."); } }

export async function handle(req: Request, env: Env, waitUntil: (p: Promise<unknown>) => void): Promise<Response> {
  let sql: Sql | null = null;
  try {
    const email = await identity(req, env);
    sql = connect(env);
    const me = await q.userByEmail(sql, email);
    if (!me) throw new HttpError(403, `${email} doesn't have access to GRIPCasting. Ask finance to add you.`);
    const path = new URL(req.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    return await route(req, sql, me, path);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on the server." }, 500);
  } finally {
    if (sql) waitUntil(sql.end({ timeout: 5 }));
  }
}

async function route(req: Request, sql: Sql, me: Me, path: string[]): Promise<Response> {
  const m = req.method, [p0, p1, p2] = path, admin = me.role === "admin";
  if (m === "GET" && p0 === "me" && !p1) return json(me);

  const h = await q.currentHarvest(sql);
  if (m === "GET" && p0 === "reference" && !p1) return json(await q.reference(sql, h.id));

  if (m === "GET" && p0 === "state" && !p1) {
    const [drivers, actuals, builds, uploads, submissions, users] = await Promise.all([
      q.drivers(sql, h.id), q.actuals(sql, h.id), q.builds(sql, h.id), q.uploads(sql, h.id), q.submissions(sql, h.id), q.users(sql),
    ]);
    return json({ drivers, actuals, builds, uploads, submissions, users });
  }

  if (m === "PUT" && p0 === "drivers" && !p1) {
    need(admin, "Only finance can change the revenue drivers.");
    const b = await body(req) as { drivers?: unknown; version?: unknown };
    const ref = await q.reference(sql, h.id);
    return json({ version: await q.saveDrivers(sql, h.id, v.drivers(b.drivers, Object.keys(ref.volDefault)), v.version(b.version), me.email) });
  }

  if (m === "PUT" && p0 === "builds" && p1 && !p2) {
    const bus = await q.busByCode(sql, h.id); if (!bus[p1]) throw new HttpError(404, "No such business unit.");
    const b = await body(req) as { doc?: unknown; version?: unknown };
    return json({ doc: await q.saveBuild(sql, h.id, p1, v.buildDoc(b.doc), v.version(b.version), me.email) });
  }

  if (m === "POST" && p0 === "actuals" && !p1) {
    need(admin, "Only finance can load actuals.");
    return json(await q.saveActuals(sql, h.id, v.actualsUpload(await body(req)), me.email));
  }
  if (m === "GET" && p0 === "actuals" && p1 && !p2) return json(await q.actuals(sql, h.id, v.isoDate(p1, "close date")));
  if (m === "GET" && p0 === "transactions" && !p1) return json(await q.transactions(sql, h.id));

  if (m === "POST" && p0 === "submissions" && !p1) {
    const b = await body(req) as Partial<SubmissionIn>;
    if (b.kind === "final") need(admin, "Only finance makes the final submission.");
    else if (b.kind !== "bu") throw new HttpError(422, "kind must be bu or final.");
    return json(await submit(sql, h.id, b.kind, b.kind === "bu" ? String(b.code || "") : null, me.email));
  }
  if (m === "GET" && p0 === "submissions" && p1 && p2 === "snapshot") {
    const s = await q.snapshot(sql, h.id, p1); if (!s) throw new HttpError(404, "No such submission.");
    return json(s);
  }
  throw new HttpError(404, "Not found.");
}

/** Snapshot what is saved right now and compute its totals here, so a submission can't differ from the saved forecast. */
async function submit(sql: Sql, harvestId: string, kind: "bu" | "final", code: string | null, email: string) {
  const [ref, d, actuals, builds, subs] = await Promise.all([q.reference(sql, harvestId), q.drivers(sql, harvestId), q.actuals(sql, harvestId), q.builds(sql, harvestId), q.submissions(sql, harvestId)]);
  initReference(ref);
  if (actuals) registerActualGLs(actuals);
  registerBuildGLs(builds);
  const drivers = mergeDrivers(d ? { vol: d.vol, gl: d.gl } : null);
  for (const b of Object.values(builds)) delete b.version;
  const snapshot: Snapshot = { drivers, builds };
  const M = compute({ drivers, actuals, builds });
  const closeDate = actuals ? actuals.closeDate : null;
  if (kind === "bu") {
    const bu = code && BU_BY_CODE[code]; if (!bu) throw new HttpError(404, "No such business unit.");
    const rows = buLines(M, bu), t = (k: "b" | "a" | "rem" | "landing" | "varc") => round2(rows.reduce((s, r) => s + r[k], 0));
    return q.addSubmission(sql, harvestId, { kind, code, closeDate, totals: { b: t("b"), a: t("a"), rem: t("rem"), landing: t("landing"), varc: t("varc") }, buSubs: null, snapshot }, email);
  }
  const buSubs: Record<string, string> = {};
  for (const s of subs) if (s.kind === "bu" && s.code && s.closeDate === closeDate && !buSubs[s.code]) buSubs[s.code] = s.id;
  return q.addSubmission(sql, harvestId, {
    kind, code: null, closeDate, buSubs, snapshot,
    totals: { b: round2(M.budget), a: round2(M.actual), rem: round2(M.cost - M.actual), landing: round2(M.cost), varc: round2(M.budget - M.cost), revenue: round2(M.revenue), ebitda: round2(M.ebitda) },
  }, email);
}
