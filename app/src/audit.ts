import { roundGrams } from "./config";

export class HttpError extends Error {
  readonly status: number;
  /** A refusal with names in it: the dictionary line and what fills its {holes}. */
  readonly words?: { key: string; vars: Record<string, string> };
  constructor(status: number, message: string, words?: { key: string; vars: Record<string, string> }) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.words = words;
  }
}

/** A refusal whose English is its dictionary line with the holes filled. */
export function refusal(status: number, words: { key: string; vars: Record<string, string> }): HttpError {
  let message = words.key;
  for (const [name, value] of Object.entries(words.vars)) message = message.split(`{${name}}`).join(value);
  return new HttpError(status, message, words);
}

export function requireReason(raw: string | null | undefined): string {
  const reason = (raw ?? "").trim();
  if (!reason) {
    throw new HttpError(400, "Reason is required.");
  }
  return reason;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function textOrNull(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}

export function requireText(raw: unknown, label: string): string {
  const s = textOrNull(raw);
  if (!s) throw new HttpError(400, `${label} is required.`);
  return s;
}

/** Where a void returns (owner ruling 2026-08-31): back to the page it started
 * from, on-site paths only; the Data Queues screen is the fallback. */
export function backRedirect(raw: unknown, fallback = "/admin/queues"): string {
  const s = textOrNull(raw);
  const back = s && s.startsWith("/") && !s.startsWith("//") ? s : fallback;
  return back + (back.includes("?") ? "&" : "?") + "ok=voided";
}

export function parseGrams(raw: unknown, label: string): number {
  const s = textOrNull(raw);
  if (s == null) throw new HttpError(400, `${label} is required.`);
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) {
    throw new HttpError(400, `${label} must be a number of grams, zero or greater.`);
  }
  return roundGrams(n);
}

/** THE PLANT COUNT (canon 0.30.62): the number of plants in a lot as typed at
 * Finish lot, at the Load Silo prompt or through the pencil. Blank is null (not
 * given, the Skip); a value must be a whole number of one or more. Accepts a
 * grouped "1,200" as the crew may type it. */
export function parsePlantCount(raw: unknown, label = "Number of plants"): number | null {
  const s = textOrNull(raw);
  if (s == null) return null;
  const cleaned = s.replace(/,/g, "");
  if (!/^\d+$/.test(cleaned)) {
    throw new HttpError(400, `${label} must be a whole number of plants, one or more.`);
  }
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new HttpError(400, `${label} must be a whole number of plants, one or more.`);
  }
  return n;
}

