import { HttpError, nowIso } from "./audit";
import { CONFIG_KEYS, SYSTEM_REASON } from "./config";
import { getConfigValue, logsForInsert } from "./db";

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

/** THE PHONE LOGIN (canon 0.30.127). Owner, 2026-09-18: "I'd like to make the
 * cloudflare login keyed to a cell phone number instead of an email address."
 * Access still hands the app one identity string; a phone login arrives from
 * the external identity provider as <digits>@<phone login domain>, and the app
 * maps it onto the person whose People row carries that phone. The domain is
 * app_config phone_login_domain (migration 0062); this is the seed. */
export const PHONE_LOGIN_DOMAIN_DEFAULT = "phone.gripcannabis.com";

/** A phone as the People row stores it: +E.164, digits only, the US country
 * code assumed on a ten-digit number ((269) 555-0100 reads +12695550100). Null
 * when the text is not a phone. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length === 10 ? `1${digits}` : digits;
  if (full.length < 11 || full.length > 15) return null;
  return `+${full}`;
}

/** The phone a login identity carries: the local part of <digits>@<domain>
 * (the identity provider's synthetic address), or a bare phone with no @ at
 * all (Access handed the phone claim itself). Null for an ordinary email. */
export function phoneFromIdentity(identity: string, domain: string): string | null {
  const value = String(identity ?? "").trim().toLowerCase();
  if (!value) return null;
  const at = value.lastIndexOf("@");
  if (at < 0) return /^\+?\d{10,15}$/.test(value) ? normalizePhone(value) : null;
  const host = value.slice(at + 1);
  if (!domain || host !== domain.trim().toLowerCase()) return null;
  return normalizePhone(value.slice(0, at));
}

export const PHONE_REFUSAL = {
  shape: "Phone must be ten digits (US) or a + country code and number.",
  taken: "That phone is already on another person.",
  unmapped: "This phone is not on the People list",
} as const;

/** First-login display name: the email's local part, editable later in Lookups. */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

/** Redirect targets after the PIN unlock stay on this site: a single leading
 * slash only, otherwise the gate falls back to /admin. */
export function safeNextPath(raw: string | null | undefined, fallback = "/admin"): string {
  const next = (raw ?? "").trim();
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  // THE MODELS BUTTON (canon 0.30.86): the Models gate falls back to /models.
  return fallback;
}

type PersonHit = Identity & { is_active: number };

/** Resolve the request's person from the login email; auto-create on first login
 * (owner ruling 2026-08-31). A deactivated person is refused, not recreated.
 * THE PHONE LOGIN (canon 0.30.127): a phone identity maps onto the person
 * carrying the phone; a phone no person carries is refused in words, never
 * auto-created (the People row is the allow list). */
export async function resolveIdentity(db: D1Database, rawEmail: string): Promise<Identity> {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new HttpError(401, "No login email on the request.");
  const domain = (await getConfigValue(db, CONFIG_KEYS.phone_login_domain)) ?? PHONE_LOGIN_DOMAIN_DEFAULT;
  const phone = phoneFromIdentity(email, domain);
  if (phone) {
    const byPhone = await findByPhone(db, phone);
    if (!byPhone) {
      throw new HttpError(403, `${PHONE_REFUSAL.unmapped}: ${phone}. Ask an admin to put it on the person in Lookups.`);
    }
    if (byPhone.is_active !== 1) {
      throw new HttpError(403, `This login is deactivated: ${phone}. Ask an admin to reactivate it in Lookups.`);
    }
    return { id: byPhone.id, display_name: byPhone.display_name, email: byPhone.email || phone };
  }
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

async function findByPhone(db: D1Database, phone: string): Promise<PersonHit | null> {
  return db
    .prepare(
      `SELECT id, display_name, COALESCE(email, '') AS email, is_active FROM people
       WHERE phone = ? AND deleted_at IS NULL`
    )
    .bind(phone)
    .first<PersonHit>();
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
