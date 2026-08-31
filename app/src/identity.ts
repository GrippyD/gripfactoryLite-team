import { HttpError, nowIso } from "./audit";
import { SYSTEM_REASON } from "./config";
import { logsForInsert } from "./db";

/** Owner ruling 2026-08-31: the actor is the Cloudflare Access login email.
 * Access enforces on all production traffic, so the header cannot arrive forged
 * from outside; JWT (AUD tag) verification stays a parked hardening item. */
export const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";

/** Local dev and smoke run without Access; requests with no header act as this identity. */
export const DEV_FALLBACK_EMAIL = "dev@local";

export type Identity = { id: string; display_name: string; email: string };

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** First-login display name: the email's local part, editable later in Lookups. */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

/** Redirect targets after the PIN unlock stay on this site: a single leading
 * slash only, otherwise the gate falls back to /admin. */
export function safeNextPath(raw: string | null | undefined): string {
  const next = (raw ?? "").trim();
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/admin";
}

type PersonHit = Identity & { is_active: number };

/** Resolve the request's person from the login email; auto-create on first login
 * (owner ruling 2026-08-31). A deactivated person is refused, not recreated. */
export async function resolveIdentity(db: D1Database, rawEmail: string): Promise<Identity> {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new HttpError(401, "No login email on the request.");
  const found = await findByEmail(db, email);
  if (found) {
    if (found.is_active !== 1) {
      throw new HttpError(403, `This login is deactivated: ${email}. Ask an admin to reactivate it in Lookups.`);
    }
    return { id: found.id, display_name: found.display_name, email: found.email };
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  const displayName = displayNameFromEmail(email);
  const record = {
    id,
    display_name: displayName,
    email,
    is_active: 1,
    created_at: ts,
    created_by: id,
  };
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO people (
            id, display_name, email, is_active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, displayName, email, ts, id, ts, id),
      ...logsForInsert(db, "people", id, record, id, SYSTEM_REASON.first_login, ts),
    ]);
  } catch (err) {
    // Two first requests can race; the unique email index settles it. Reread.
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes("unique")) throw err;
    const winner = await findByEmail(db, email);
    if (winner && winner.is_active === 1) {
      return { id: winner.id, display_name: winner.display_name, email: winner.email };
    }
    throw err;
  }
  return { id, display_name: displayName, email };
}

async function findByEmail(db: D1Database, email: string): Promise<PersonHit | null> {
  return db
    .prepare(
      `SELECT id, display_name, email, is_active FROM people
       WHERE lower(email) = ? AND deleted_at IS NULL`
    )
    .bind(email)
    .first<PersonHit>();
}
