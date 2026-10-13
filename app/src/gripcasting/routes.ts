/* /models/gripcasting/api/*. Identity is GFLite's Access email. Role is gc_app_users.
 * Admin (finance) loads actuals, sets drivers, and makes the final submission.
 * A director edits and submits builds. Both read everything. No row is 403. */
import { Hono } from "hono";
import type { Identity } from "../identity";
import { HttpError } from "./http";
import { BU_BY_CODE, buLines, compute, initReference, mergeDrivers, registerActualGLs, registerBuildGLs, round2 } from "./model";
import * as q from "./queries";
import type { Me, Snapshot, SubmissionIn } from "./types";
import * as v from "./validate";

type GcEnv = { Bindings: { DB: D1Database }; Variables: { actor: Identity } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const need = (ok: boolean, msg = "You don't have permission to do that.") => {
  if (!ok) throw new HttpError(403, msg);
};

export async function handleGripcasting(db: D1Database, email: string, method: string, path: string[], body: unknown): Promise<Response> {
  try {
    const me = await q.userByEmail(db, email);
    if (!me) throw new HttpError(403, `${email.trim().toLowerCase()} doesn't have access to GRIPCasting. Ask finance to add you.`);
    return await route(db, me, method, path, body);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Something went wrong on the server." }, 500);
  }
}

async function route(db: D1Database, me: Me, method: string, path: string[], body: unknown): Promise<Response> {
  const [p0, p1, p2] = path;
  const admin = me.role === "admin";
  if (method === "GET" && p0 === "me" && !p1) return json(me);

  const h = await q.currentHarvest(db);
  if (method === "GET" && p0 === "reference" && !p1) return json(await q.reference(db, h.id));

  if (method === "GET" && p0 === "state" && !p1) return json(await q.loadState(db, h.id));

  if (method === "PUT" && p0 === "drivers" && !p1) {
    need(admin, "Only finance can change the revenue drivers.");
    const b = (body ?? {}) as { drivers?: unknown; version?: unknown };
    const ref = await q.reference(db, h.id);
    return json({ version: await q.saveDrivers(db, h.id, v.drivers(b.drivers, Object.keys(ref.volDefault)), v.version(b.version), me.email) });
  }

  if (method === "PUT" && p0 === "builds" && p1 && !p2) {
    const bus = await q.busByCode(db, h.id);
    if (!bus[p1]) throw new HttpError(404, "No such business unit.");
    const b = (body ?? {}) as { doc?: unknown; version?: unknown };
    return json({ doc: await q.saveBuild(db, h.id, p1, v.buildDoc(b.doc), v.version(b.version), me.email) });
  }

  if (method === "POST" && p0 === "actuals" && !p1) {
    need(admin, "Only finance can load actuals.");
    return json(await q.saveActuals(db, h.id, v.actualsUpload(body), me.email));
  }
  if (method === "GET" && p0 === "actuals" && p1 && !p2) return json(await q.actuals(db, h.id, v.isoDate(p1, "close date")));
  if (method === "GET" && p0 === "transactions" && !p1) return json(await q.transactions(db, h.id));

  if (method === "POST" && p0 === "submissions" && !p1) {
    const b = (body ?? {}) as Partial<SubmissionIn>;
    if (b.kind === "final") need(admin, "Only finance makes the final submission.");
    else if (b.kind !== "bu") throw new HttpError(422, "kind must be bu or final.");
    return json(await submit(db, h.id, b.kind, b.kind === "bu" ? String(b.code || "") : null, me.email));
  }
  if (method === "GET" && p0 === "submissions" && p1 && p2 === "snapshot") {
    const s = await q.snapshot(db, h.id, p1);
    if (!s) throw new HttpError(404, "No such submission.");
    return json(s);
  }
  throw new HttpError(404, "Not found.");
}

/** Snapshot what is saved right now and compute its totals here, so a submission can't differ from the saved forecast. */
async function submit(db: D1Database, harvestId: string, kind: "bu" | "final", code: string | null, email: string) {
  const [ref, d, actuals, buildRows, subs] = await Promise.all([
    q.reference(db, harvestId),
    q.drivers(db, harvestId),
    q.actuals(db, harvestId),
    q.builds(db, harvestId),
    q.submissions(db, harvestId),
  ]);
  initReference(ref);
  if (actuals) registerActualGLs(actuals);
  registerBuildGLs(buildRows);
  const drivers = mergeDrivers(d ? { vol: d.vol, gl: d.gl } : null);
  for (const b of Object.values(buildRows)) delete b.version;
  const snapshot: Snapshot = { drivers, builds: buildRows };
  const M = compute({ drivers, actuals, builds: buildRows });
  const closeDate = actuals ? actuals.closeDate : null;
  if (kind === "bu") {
    const bu = code && BU_BY_CODE[code];
    if (!bu) throw new HttpError(404, "No such business unit.");
    const rows = buLines(M, bu);
    const t = (k: "b" | "a" | "rem" | "landing" | "varc") => round2(rows.reduce((s, r) => s + r[k], 0));
    return q.addSubmission(db, harvestId, {
      kind, code, closeDate,
      totals: { b: t("b"), a: t("a"), rem: t("rem"), landing: t("landing"), varc: t("varc") },
      buSubs: null, snapshot,
    }, email);
  }
  const buSubs: Record<string, string> = {};
  for (const s of subs) if (s.kind === "bu" && s.code && s.closeDate === closeDate && !buSubs[s.code]) buSubs[s.code] = s.id;
  return q.addSubmission(db, harvestId, {
    kind, code: null, closeDate, buSubs, snapshot,
    totals: {
      b: round2(M.budget), a: round2(M.actual), rem: round2(M.cost - M.actual), landing: round2(M.cost), varc: round2(M.budget - M.cost),
      revenue: round2(M.revenue), ebitda: round2(M.ebitda),
    },
  }, email);
}

export function gripcastingApi(): Hono<GcEnv> {
  const gc = new Hono<GcEnv>();
  gc.all("*", async (c) => {
    const rest = c.req.path.replace(/^\/models\/gripcasting\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    let body: unknown;
    if (c.req.method === "PUT" || c.req.method === "POST") {
      try {
        body = await c.req.json();
      } catch {
        return json({ error: "The request body isn't valid JSON." }, 400);
      }
    }
    return handleGripcasting(c.env.DB, c.get("actor").email, c.req.method, rest, body);
  });
  return gc;
}

export function mountGripcasting(app: Hono<{ Bindings: Env; Variables: { actor: Identity } }>): void {
  app.route("/models/gripcasting/api", gripcastingApi() as never);
}
