/* Identity comes from the edge, never from the client.
   Live: Cloudflare Access puts a signed JWT in Cf-Access-Jwt-Assertion; we verify it against the team's
   published keys and the application's audience tag, then use its email claim.
   Local: there is no Access, so DEV_USER_EMAIL stands in, but only when ENVIRONMENT is "local" AND the request
   is to localhost. A deployed app can't satisfy both. */
import { HttpError, type Env } from "./env";

interface Jwk extends JsonWebKey { kid: string }
const certCache = new Map<string, { keys: Jwk[]; until: number }>();

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as Record<string, unknown>;

async function accessKeys(team: string, refresh = false): Promise<Jwk[]> {
  const hit = certCache.get(team);
  if (hit && !refresh && hit.until > Date.now()) return hit.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new HttpError(503, "Couldn't reach Cloudflare Access to check the sign-in.");
  const body = await res.json() as { keys: Jwk[] };
  certCache.set(team, { keys: body.keys, until: Date.now() + 60 * 60 * 1000 });
  return body.keys;
}

export async function verifyAccessJwt(token: string, teamDomain: string, aud: string): Promise<Record<string, unknown>> {
  const team = teamDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Invalid sign-in token.");
  const [h, p, s] = parts;
  const header = b64urlJson(h), claims = b64urlJson(p);
  if (header.alg !== "RS256") throw new HttpError(401, "Invalid sign-in token.");
  let jwk = (await accessKeys(team)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await accessKeys(team, true)).find(k => k.kid === header.kid);   // keys rotate
  if (!jwk) throw new HttpError(401, "Invalid sign-in token.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new HttpError(401, "Invalid sign-in token.");
  const now = Math.floor(Date.now() / 1000), auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (typeof claims.exp !== "number" || claims.exp < now) throw new HttpError(401, "Sign-in expired. Reload the page.");
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) throw new HttpError(401, "Invalid sign-in token.");
  if (!auds.includes(aud)) throw new HttpError(401, "Invalid sign-in token.");
  if (claims.iss !== `https://${team}`) throw new HttpError(401, "Invalid sign-in token.");
  if (typeof claims.email !== "string" || !claims.email) throw new HttpError(401, "Sign-in has no email.");
  return claims;
}

export async function identity(req: Request, env: Env): Promise<string> {
  if (env.ENVIRONMENT === "local") {
    const host = new URL(req.url).hostname;
    if ((host === "localhost" || host === "127.0.0.1") && env.DEV_USER_EMAIL) return env.DEV_USER_EMAIL.trim().toLowerCase();
    throw new HttpError(401, "Local sign-in only works on localhost with DEV_USER_EMAIL set in .dev.vars.");
  }
  const token = req.headers.get("cf-access-jwt-assertion");
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) throw new HttpError(500, "Cloudflare Access isn't configured for this app.");
  if (!token) throw new HttpError(401, "Not signed in.");
  const claims = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
  return String(claims.email).trim().toLowerCase();
}
