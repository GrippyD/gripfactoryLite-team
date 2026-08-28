export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
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

export function parseGrams(raw: unknown, label: string): number {
  const s = textOrNull(raw);
  if (s == null) throw new HttpError(400, `${label} is required.`);
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) {
    throw new HttpError(400, `${label} must be a number of grams, zero or greater.`);
  }
  return Math.round(n * 100) / 100;
}

