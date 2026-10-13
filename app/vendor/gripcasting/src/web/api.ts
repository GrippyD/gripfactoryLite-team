/* The browser's only door to data: the app's own API (Cloudflare Pages Functions -> Hyperdrive -> Postgres).
   Same calls locally (wrangler pages dev + local Postgres) and live (Cloudflare Access + Supabase). */
import type { Actuals, ActualsUpload, BuildDoc, Drivers, Me, Reference, Snapshot, StatePayload, Submission, SubmissionIn, Tx, Upload } from "../shared/types";

export type ApiCode = "conflict" | "forbidden" | "unauthenticated" | "not_found" | "invalid" | "failed";
export class ApiError extends Error {
  constructor(public code: ApiCode, message: string, public status = 0) { super(message); }
}
const CODES: Record<number, ApiCode> = { 400: "invalid", 401: "unauthenticated", 403: "forbidden", 404: "not_found", 409: "conflict", 422: "invalid" };

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/" + path, {
      method, credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) { throw new ApiError("failed", "Couldn't reach the server."); }
  if (!res.ok) {
    let msg = res.statusText; try { const j = await res.json() as { error?: string }; if (j.error) msg = j.error; } catch { /* not json */ }
    throw new ApiError(CODES[res.status] || "failed", msg, res.status);
  }
  return res.status === 204 ? (undefined as T) : await res.json() as T;
}

export const api = {
  me: () => call<Me>("GET", "me"),
  reference: () => call<Reference>("GET", "reference"),
  state: () => call<StatePayload>("GET", "state"),
  /** optimistic lock: version = updated_at as loaded; 409 conflict when someone saved in between */
  saveDrivers: (drivers: Drivers, version: string | null) => call<{ version: string }>("PUT", "drivers", { drivers, version }),
  saveBuild: (code: string, doc: BuildDoc, version: string | null) => call<{ doc: BuildDoc }>("PUT", "builds/" + encodeURIComponent(code), { doc, version }),
  uploadActuals: (body: ActualsUpload) => call<{ actuals: Actuals; upload: Upload }>("POST", "actuals", body),
  actuals: (closeDate: string) => call<Actuals | null>("GET", "actuals/" + encodeURIComponent(closeDate)),
  transactions: () => call<{ meta: { closeDate: string; fileName: string; from: string | null; to: string | null } | null; rows: Tx[] }>("GET", "transactions"),
  submit: (body: SubmissionIn) => call<Submission>("POST", "submissions", body),
  snapshot: (id: string) => call<Snapshot>("GET", "submissions/" + encodeURIComponent(id) + "/snapshot"),
};

/** Saves for one document go out one at a time, each carrying the version the previous save returned. */
export class SaveQueue<T> {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(public version: string | null, private send: (value: T, version: string | null) => Promise<string | null>) {}
  save(value: T): Promise<void> {
    const run = this.chain.then(async () => { this.version = await this.send(value, this.version); });
    this.chain = run.catch(() => undefined);
    return run;
  }
}
