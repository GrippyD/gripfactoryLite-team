/**
 * THE SERVICE ACTOR (canon 0.30.140). Corey's agent through the owner,
 * 2026-09-20, verbatim: "Access: read only. A GET route only, no write scope
 * anywhere. A Cloudflare Access service token scoped to that one route
 * (CF-Access-Client-Id and CF-Access-Client-Secret headers), or an Access
 * bypass on just that path. If it is easier to hand over a broader key, do
 * not." The owner's pick on the question tool: "Build THE SERVICE ACTOR
 * guard". Before this, a token request acted as dev@local with full write (his
 * 0.30.136 pick, as asked); the guard closes that.
 *
 * Cloudflare Access fronts every production request. A person arrives with the
 * login email header; a service token arrives with none (Access mints the
 * token's JWT without an email). So on the Access-fronted worker (the wrangler
 * var ACCESS_FRONTED = "1" in env.grip) a request with no login email is a
 * service actor: it may GET the machine routes below and nothing else; every
 * other path and every write answers 403 in words as JSON. The actor is a fixed
 * identity, never a people row, so no row is born and no write can carry it.
 * Local dev and the smoke run without the var and keep the dev fallback.
 */

import type { Identity } from "./identity";

export const ACCESS_FRONTED_VAR = "ACCESS_FRONTED";

/** The fixed face of a token request: not a people row, never an author. */
export const SERVICE_IDENTITY: Identity = {
  id: "service-token",
  display_name: "Service token",
  email: "service@access",
};

/** The doors a service token may use: the Drying Operations menu (Silo Ops
 * watches it hourly), the machine feeds (the trim weighs puller, GET), the
 * silo strip's live JSON (GET and HEAD), the cure-room sensor push
 * (POST /sensors/readings), and the lab samples door
 * (POST /feeds/lab-samples.json, the tagleaf-pusher token). */
export const SERVICE_ROUTES = {
  exact: ["/ops/drying_ops", "/silos/live.json"],
  prefixes: ["/feeds/"],
  post: ["/sensors/readings", "/feeds/lab-samples.json"],
} as const;

export const SERVICE_REFUSAL =
  "This service token reads /ops/drying_ops, /feeds and /silos/live.json, and may POST /sensors/readings and /feeds/lab-samples.json; nothing else answers it.";

/** True on the Access-fronted worker (env.grip carries ACCESS_FRONTED = "1"). */
export function isAccessFronted(env: unknown): boolean {
  const value = (env as { ACCESS_FRONTED?: unknown } | null | undefined)?.ACCESS_FRONTED;
  return value === "1" || value === "true" || value === true;
}

/** The login email Access put on the request, or null when the header is absent or blank. */
export function loginEmailOf(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

/** Whether a service actor may make this request: a read of one of the doors,
 * or the one sensor push. */
export function isServiceRoute(method: string, pathname: string): boolean {
  const verb = String(method ?? "").toUpperCase();
  const path = String(pathname ?? "").replace(/\/+$/, "") || "/";
  if (verb === "POST") return (SERVICE_ROUTES.post as readonly string[]).includes(path);
  if (verb !== "GET" && verb !== "HEAD") return false;
  if ((SERVICE_ROUTES.exact as readonly string[]).includes(path)) return true;
  return SERVICE_ROUTES.prefixes.some((prefix) => path.startsWith(prefix));
}
