/**
 * THE TESTING DESK (canon 0.30.164), part 3. The Metrc mirror is read-only.
 * Basic auth uses two wrangler secrets, METRC_INTEGRATOR_KEY and
 * METRC_USER_KEY. They are never vars and never written into a file, a log,
 * or this page. The base URL is the var METRC_API_BASE, sandbox unless the
 * owner points env.grip at production. The write switch below stays off:
 * POST /packages/v2/testing is shaped and not sent.
 *
 * MA1 Phase B (the client). Law 3, THE SWITCH AND HOST LAW: keys go only to a
 * Metrc host (sandbox-api-XX or api-XX .metrc.com, A8), and a write is sent
 * only by metrcSend, only on a sandbox host, only with METRC_EVAL_ENABLED
 * "true". Law 4, THE LAW OF SECRETS: one user key spans every facility its
 * user is on (page_getting-started.txt:39), so userKeyFor returns
 * METRC_USER_KEY for every license (A4); failed-call words are scrubbed of
 * the raw keys and the Basic token, and no key-bearing query reaches a log
 * row (A34). Law 5's pager, cursor and budget live in metrcpager.ts.
 *
 * MA1 Phase D (Law 9, THE ADMIN SURFACE): metrcApiPage renders the whole
 * /admin/metrc-api page in the order of the spec (host and mode, keys, calls
 * this month, per endpoint, Sweep now, parity, the lab sweep, the write
 * switch), every element with a native title help, every string EN and ES;
 * the figures beyond the client's own are loaded by metrcadmin.ts. The smoke's
 * stub seam (A32): METRC_STUB_BASE is honoured only with METRC_STUB_ENABLED
 * "1" and a local http origin, reads as a sandbox host for the page and the
 * mode law (write stays impossible against it), and never lives in
 * wrangler.toml; the two host regexes are unchanged.
 */

import { nowIso } from "./audit";
import { ADMIN_METRC_API_PATH, SYSTEM_REASON } from "./config";
import { insertLog } from "./db";
import { releaseTestedFromMirror } from "./metrc";
import { t, tFill, type Locale } from "./i18n";
import { easternStamp } from "./sheetsync";
import { esc } from "./ui";

declare global {
  interface Env {
    METRC_INTEGRATOR_KEY?: string;
    METRC_USER_KEY?: string;
    METRC_API_BASE?: string;
    // MA1 Law 3: the evaluation switch, a var, absent (false) unless set to "true".
    METRC_EVAL_ENABLED?: string;
    // MA1 A32: the smoke's local stub, set only by the smoke's own wrangler dev run.
    METRC_STUB_BASE?: string;
    METRC_STUB_ENABLED?: string;
  }
}

export const METRC_SANDBOX_BASE = "https://sandbox-api-mi.metrc.com";
/** MA1 Law 3. The sandbox host shape is the research note's annotation of
 * Metrc's Sandbox Status mail (RESEARCH/2026-09-21_metrc_connect_thread.md:11);
 * the docs name only https://api-mi.metrc.com. Tested against metrcBase(env),
 * which is url.origin, never against the raw var. */
export const SANDBOX_BASE_RE = /^https:\/\/sandbox-api-[a-z]{2}\.metrc\.com$/;
export const PRODUCTION_BASE_RE = /^https:\/\/api-[a-z]{2}\.metrc\.com$/;
export const METRC_HOST_REFUSAL = "The METRC host is not a Metrc host.";
export const METRC_PAGE_SIZE = 20;
export const METRC_MAX_PAGES = 20;
/** One hour plus five minutes, the docs' polling window. */
export const METRC_WINDOW_MS = 65 * 60 * 1000;
/** The switch is off. Nothing in this slice POSTs to Metrc. */
export const METRC_WRITE_ENABLED = false;
/** The longest Retry-After wait, a code constant (A27). */
export const METRC_RETRY_CAP_MS = 10_000;

export type MetrcEnv = {
  DB: D1Database;
  METRC_INTEGRATOR_KEY?: string;
  METRC_USER_KEY?: string;
  METRC_API_BASE?: string;
  METRC_EVAL_ENABLED?: string;
  METRC_STUB_BASE?: string;
  METRC_STUB_ENABLED?: string;
};

/** The vars that decide the host: the base, and the smoke's stub pair (A32). */
export type MetrcHostEnv = Pick<MetrcEnv, "METRC_API_BASE" | "METRC_STUB_BASE" | "METRC_STUB_ENABLED">;

export type MetrcHostKind = "sandbox" | "production" | "other";

/** MA1 A32: the only origins the stub may name, a local http port. */
export const METRC_STUB_ORIGIN_RE = /^http:\/\/(127\.0\.0\.1|localhost):\d{1,5}$/;

/** MA1 A32: the smoke's stub origin, or null. Honoured only when
 * METRC_STUB_ENABLED is exactly "1" and METRC_STUB_BASE is an http origin on
 * 127.0.0.1 or localhost with a port; anything else (another host, https, a
 * missing port, the var alone) is refused and the real base applies. Neither
 * var is set in wrangler.toml; the smoke passes both to its own wrangler dev. */
export function metrcStubBase(env: MetrcHostEnv): string | null {
  if (env.METRC_STUB_ENABLED !== "1") return null;
  const raw = (env.METRC_STUB_BASE ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:") return null;
    return METRC_STUB_ORIGIN_RE.test(url.origin) ? url.origin : null;
  } catch {
    return null;
  }
}

/** MA1 Law 3 (A8): GET calls are refused before any key is attached. */
export class MetrcHostRefused extends Error {
  constructor() {
    super(METRC_HOST_REFUSAL);
    this.name = "MetrcHostRefused";
  }
}

export type MetrcTrigger = "cron" | "admin";

export type SampleMirror = {
  id: string;
  sample_tag: string;
  metrc_lab_testing_state: string | null;
  metrc_state_date: string | null;
  metrc_result_id: string | null;
  coa_file_id: string | null;
  overall_passed: number | null;
  thc_total_pct: number | null;
};

export type OrderMirror = {
  id: string;
  source_package_tag: string | null;
  metrc_lab_testing_state: string | null;
  metrc_state_date: string | null;
};

export type FieldChange = {
  table: "test_samples" | "test_orders";
  id: string;
  field: string;
  old_value: string | null;
  new_value: string;
};

export type TestingPostBody = {
  Tag: string;
  Item: string;
  UseSameItem: true;
  Quantity: number;
  UnitOfMeasure: "Grams";
  ActualDate: string;
  Ingredients: Array<{ Package: string; Quantity: number; UnitOfMeasure: "Grams" }>;
  RequiredLabTestBatches: string[];
};

export type CallRow = { started_at: string; path: string; status: number; ms: number };

type GetOpts = {
  env: Pick<MetrcEnv, "METRC_INTEGRATOR_KEY" | "METRC_USER_KEY"> & MetrcHostEnv;
  path: string;
  query?: Record<string, string>;
  /** MA1 Law 4: the user key for this call; METRC_USER_KEY when not given. */
  userKey?: string;
  /** MA1 Law 5 (the pager): a first 429 whose Retry-After is above the cap is
   * returned at once, not slept on. The lab sweep leaves this off. */
  stopAboveCap?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
  clock?: () => number;
  record?: (row: CallRow) => Promise<void>;
};

export type GetResult = { status: number; body: unknown; attempts: number; retryAfter: string | null };

export function keysPresent(env: Pick<MetrcEnv, "METRC_INTEGRATOR_KEY" | "METRC_USER_KEY">): { integrator: boolean; user: boolean } {
  return {
    integrator: (env.METRC_INTEGRATOR_KEY ?? "").trim() !== "",
    user: (env.METRC_USER_KEY ?? "").trim() !== "",
  };
}

/** https origin, or the sandbox when the var is blank or not https. The
 * smoke's stub origin wins when metrcStubBase admits it (A32). */
export function metrcBase(env: MetrcHostEnv): string {
  const stub = metrcStubBase(env);
  if (stub) return stub;
  const raw = (env.METRC_API_BASE ?? "").trim().replace(/\/+$/, "");
  if (!raw) return METRC_SANDBOX_BASE;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return METRC_SANDBOX_BASE;
    return url.origin;
  } catch {
    return METRC_SANDBOX_BASE;
  }
}

export function metrcHost(env: MetrcHostEnv): string {
  return new URL(metrcBase(env)).host;
}

/** MA1 Law 3 (A8): sandbox, production, or other (keys never go to other).
 * The smoke's stub (A32) reads as a sandbox host, so the page and the mode law
 * treat it as one: write mode stays impossible against it. */
export function metrcHostKind(env: MetrcHostEnv): MetrcHostKind {
  if (metrcStubBase(env)) return "sandbox";
  const base = metrcBase(env);
  if (SANDBOX_BASE_RE.test(base)) return "sandbox";
  if (PRODUCTION_BASE_RE.test(base)) return "production";
  return "other";
}

/** MA1 Law 4 (A4): the user key belongs to the Metrc user and spans every
 * facility that user is on (page_getting-started.txt:39), so every license
 * reads METRC_USER_KEY; no per-license key map exists or is read. Null when
 * blank. */
export function userKeyFor(env: Pick<MetrcEnv, "METRC_USER_KEY">, _license: string): string | null {
  const key = (env.METRC_USER_KEY ?? "").trim();
  return key ? key : null;
}

export type SweepMode = "off" | "dry_run" | "write";
export const SWEEP_MODE_UNKNOWN = "The sweep mode is not off, dry_run or write, so the sweep is off.";
export const SWEEP_WRITE_ON_SANDBOX = "Write mode is refused on a sandbox host: sandbox data never enters the live mirror. The sweep runs as a dry run.";
export const SWEEP_WRITE_ON_OTHER = "Write mode is refused: the METRC host is not a Metrc host. The sweep is off.";
export const SWEEP_ON_OTHER = "The METRC host is not a Metrc host. The sweep is off.";

/** MA1 Law 3 and Law 7: the mode the sweep runs in. Blank or unknown is off;
 * write runs only on a production host; the code never promotes itself. */
export function resolveSweepMode(env: MetrcHostEnv, configured: string | null): { mode: SweepMode; refusal: string | null } {
  const value = String(configured ?? "").trim().toLowerCase();
  if (value === "" || value === "off") return { mode: "off", refusal: null };
  if (value !== "dry_run" && value !== "write") return { mode: "off", refusal: SWEEP_MODE_UNKNOWN };
  const kind = metrcHostKind(env);
  if (kind === "other") return { mode: "off", refusal: value === "write" ? SWEEP_WRITE_ON_OTHER : SWEEP_ON_OTHER };
  if (value === "dry_run") return { mode: "dry_run", refusal: null };
  if (kind === "production") return { mode: "write", refusal: null };
  return { mode: "dry_run", refusal: SWEEP_WRITE_ON_SANDBOX };
}

/** House facility licenses. Safety-compliance licenses are not facilities we sweep. */
export function facilityLicense(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (!v) return false;
  if (v.startsWith("SC-") || v.startsWith("AU-SC-")) return false;
  return true;
}

export function modifiedWindow(nowMs: number): { start: string; end: string } {
  return { start: new Date(nowMs - METRC_WINDOW_MS).toISOString(), end: new Date(nowMs).toISOString() };
}

/** The path and query a log row keeps. MA1 A34: every query parameter whose
 * name holds "key" (any case) is dropped first, so a key never reaches
 * metrc_api_calls. The URL sent to Metrc is not changed. */
export function callPath(url: string): string {
  const u = new URL(url);
  const keyNames = [...u.searchParams.keys()].filter((name) => /key/i.test(name));
  for (const name of keyNames) u.searchParams.delete(name);
  return (u.pathname + u.search).slice(0, 500);
}

/** Seconds, capped. An HTTP-date, other text, or a blank or missing header
 * waits one second (0.30.185 assumption 6; MA1 A9 fixed the blank case, which
 * read Number("") as 0 and waited 0 ms). */
export function retryAfterMs(header: string | null): number {
  const raw = String(header ?? "").trim();
  if (raw === "") return 1000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 1000;
  return Math.min(METRC_RETRY_CAP_MS, Math.round(n * 1000));
}

/** MA1 Law 5: a Retry-After of more seconds than the cap allows. */
export function retryAfterAboveCap(header: string | null): boolean {
  const raw = String(header ?? "").trim();
  if (raw === "") return false;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n * 1000 > METRC_RETRY_CAP_MS;
}

/** The base64 token of the Basic header (integrator:user), built in memory.
 * Blank when a key holds a character btoa cannot encode, so a catch block
 * that scrubs with it never throws a second time (MA1 fix F2). */
export function basicToken(integrator: string, user: string): string {
  try {
    return btoa(`${integrator}:${user}`);
  } catch {
    return "";
  }
}

/** MA1 Law 4: a key a Basic header cannot carry is refused before any call. */
export const KEY_CHARACTER_REFUSAL = "A METRC key holds a character a Basic header cannot carry.";

/** MA1 Law 3 (A8): the request URL, built once. A path that is absolute,
 * protocol-relative or backslashed can carry the URL off the METRC origin;
 * that is refused (MetrcHostRefused) before a key is attached or a call is
 * recorded, so keys and writes go only to metrcBase(env). */
export function metrcUrl(env: MetrcHostEnv, path: string, query?: Record<string, string>): URL {
  const base = metrcBase(env);
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  if (url.origin !== base) throw new MetrcHostRefused();
  return url;
}

/** Replaces each key of 4 or more characters with [key]. MA1 Law 4: callers
 * also pass the Basic token, and its "Basic <token>" form goes first, whole. */
export function scrubKeys(text: string, keys: Array<string | null | undefined>): string {
  let out = text;
  const list = keys
    .map((key) => (key ?? "").trim())
    .filter((key) => key.length >= 4)
    .sort((a, b) => b.length - a.length);
  for (const k of list) out = out.split(`Basic ${k}`).join("[key]");
  for (const k of list) out = out.split(k).join("[key]");
  return out.slice(0, 400);
}

export function pageData(body: unknown): { rows: unknown[]; totalPages: number | null } {
  if (Array.isArray(body)) return { rows: body, totalPages: null };
  if (!body || typeof body !== "object") return { rows: [], totalPages: null };
  const data = (body as { Data?: unknown }).Data;
  const total = Number((body as { TotalPages?: unknown }).TotalPages);
  return {
    rows: Array.isArray(data) ? data : [],
    totalPages: Number.isFinite(total) && total > 0 ? total : null,
  };
}

export function facilityCount(body: unknown): number {
  if (Array.isArray(body)) return body.length;
  return pageData(body).rows.length;
}

function textOf(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function numberOf(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function blankText(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

/** Prefer a test type whose name says THC and total. Otherwise the first THC level. */
export function thcFromResults(rows: unknown[]): number | null {
  let fallback: number | null = null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const name = (textOf((row as { TestTypeName?: unknown }).TestTypeName) ?? "").toLowerCase();
    const level = numberOf((row as { TestResultLevel?: unknown }).TestResultLevel);
    if (level == null || !name.includes("thc")) continue;
    if (name.includes("total")) return level;
    if (fallback == null) fallback = level;
  }
  return fallback;
}

function pushChange(out: FieldChange[], table: FieldChange["table"], id: string, field: string, oldValue: string | null, next: string | null): void {
  if (next == null) return;
  if ((oldValue ?? "") === next) return;
  out.push({ table, id, field, old_value: oldValue, new_value: next });
}

/**
 * Fills only columns the desk left blank. A later Metrc value does not
 * replace a number or a state already stored. Results attach to the sample
 * whose tag is the package label.
 */
export function mirrorChanges(input: { samples: SampleMirror[]; orders: OrderMirror[]; packages: unknown[]; resultsByLabel: Map<string, unknown[]> }): FieldChange[] {
  const samples = input.samples.map((row) => ({ ...row }));
  const orders = input.orders.map((row) => ({ ...row }));
  const out: FieldChange[] = [];
  for (const pkg of input.packages) {
    if (!pkg || typeof pkg !== "object") continue;
    const label = textOf((pkg as { Label?: unknown }).Label);
    if (!label) continue;
    const state = textOf((pkg as { LabTestingState?: unknown }).LabTestingState);
    const stateDate = textOf((pkg as { LabTestingStateDate?: unknown }).LabTestingStateDate);
    for (const sample of samples) {
      if (sample.sample_tag !== label) continue;
      if (blankText(sample.metrc_lab_testing_state) && state) {
        pushChange(out, "test_samples", sample.id, "metrc_lab_testing_state", sample.metrc_lab_testing_state, state);
        sample.metrc_lab_testing_state = state;
      }
      if (blankText(sample.metrc_state_date) && stateDate) {
        pushChange(out, "test_samples", sample.id, "metrc_state_date", sample.metrc_state_date, stateDate);
        sample.metrc_state_date = stateDate;
      }
    }
    for (const order of orders) {
      if ((order.source_package_tag ?? "") !== label) continue;
      if (blankText(order.metrc_lab_testing_state) && state) {
        pushChange(out, "test_orders", order.id, "metrc_lab_testing_state", order.metrc_lab_testing_state, state);
        order.metrc_lab_testing_state = state;
      }
      if (blankText(order.metrc_state_date) && stateDate) {
        pushChange(out, "test_orders", order.id, "metrc_state_date", order.metrc_state_date, stateDate);
        order.metrc_state_date = stateDate;
      }
    }
    const results = input.resultsByLabel.get(label) ?? [];
    const sample = samples.find((row) => row.sample_tag === label);
    if (!sample || results.length === 0) continue;
    const first = results.find((row) => row && typeof row === "object") as
      | { LabTestResultId?: unknown; LabTestResultDocumentFileId?: unknown; OverallPassed?: unknown }
      | undefined;
    if (first && blankText(sample.metrc_result_id)) {
      const id = textOf(first.LabTestResultId);
      if (id) {
        pushChange(out, "test_samples", sample.id, "metrc_result_id", sample.metrc_result_id, id);
        sample.metrc_result_id = id;
      }
    }
    if (first && blankText(sample.coa_file_id)) {
      const file = textOf(first.LabTestResultDocumentFileId);
      if (file) {
        pushChange(out, "test_samples", sample.id, "coa_file_id", sample.coa_file_id, file);
        sample.coa_file_id = file;
      }
    }
    if (sample.overall_passed == null && first && typeof first.OverallPassed === "boolean") {
      const flag = first.OverallPassed ? "1" : "0";
      pushChange(out, "test_samples", sample.id, "overall_passed", null, flag);
      sample.overall_passed = first.OverallPassed ? 1 : 0;
    }
    if (sample.thc_total_pct == null) {
      const thc = thcFromResults(results);
      if (thc != null) {
        pushChange(out, "test_samples", sample.id, "thc_total_pct", null, String(thc));
        sample.thc_total_pct = thc;
      }
    }
  }
  return out;
}

/** The body POST /packages/v2/testing would send. This slice does not send it. */
export function testingPackagePayload(input: {
  tag: string;
  item: string;
  grams: number;
  actualDate: string;
  sourceTag: string;
  sourceGrams: number;
  batches: string[];
}): TestingPostBody {
  return {
    Tag: input.tag,
    Item: input.item,
    UseSameItem: true,
    Quantity: input.grams,
    UnitOfMeasure: "Grams",
    ActualDate: input.actualDate,
    Ingredients: [{ Package: input.sourceTag, Quantity: input.sourceGrams, UnitOfMeasure: "Grams" }],
    RequiredLabTestBatches: input.batches,
  };
}

export function testingPostRequest(license: string, bodies: TestingPostBody[]): { method: "POST"; path: string; body: string } | null {
  const request = {
    method: "POST" as const,
    path: `/packages/v2/testing?licenseNumber=${encodeURIComponent(license)}`,
    body: JSON.stringify(bodies),
  };
  return METRC_WRITE_ENABLED ? request : null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One GET. A 429 is counted, then retried once after Retry-After. MA1 Law 3:
 * on a host that is not a Metrc host, or for a path that leaves the METRC
 * origin, it attaches no key, makes no fetch, records nothing, and throws
 * MetrcHostRefused. A key the Basic header cannot carry throws the plain
 * KEY_CHARACTER_REFUSAL, also before any fetch or record. Redirects are not
 * followed (redirect "manual"), so a key never rides a 3xx to another origin;
 * a 3xx comes back as its own status for the caller to treat as a failure. */
export async function metrcGet(opts: GetOpts): Promise<GetResult> {
  if (metrcHostKind(opts.env) === "other") throw new MetrcHostRefused();
  const url = metrcUrl(opts.env, opts.path, opts.query);
  const integrator = (opts.env.METRC_INTEGRATOR_KEY ?? "").trim();
  const user = (opts.userKey != null ? opts.userKey : opts.env.METRC_USER_KEY ?? "").trim();
  const token = basicToken(integrator, user);
  if (!token) throw new Error(KEY_CHARACTER_REFUSAL);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? nowIso;
  const clock = opts.clock ?? Date.now;
  const record = opts.record ?? (async () => undefined);
  const path = callPath(url.toString());
  const once = async (): Promise<{ status: number; body: unknown; retry: string | null }> => {
    const started = now();
    const t0 = clock();
    let status = 0;
    let body: unknown = null;
    let retry: string | null = null;
    try {
      const res = await fetchImpl(url.toString(), {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "application/json", Authorization: `Basic ${token}` },
      });
      status = res.status;
      retry = res.headers.get("Retry-After");
      const text = await res.text();
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = null;
        }
      }
      return { status, body, retry };
    } catch (err) {
      status = 0;
      throw new Error(scrubKeys(err instanceof Error ? err.message : String(err), [integrator, user, token]));
    } finally {
      await record({ started_at: started, path, status, ms: Math.max(0, clock() - t0) });
    }
  };
  const first = await once();
  if (first.status !== 429) return { status: first.status, body: first.body, attempts: 1, retryAfter: first.retry };
  if (opts.stopAboveCap && retryAfterAboveCap(first.retry)) return { status: first.status, body: first.body, attempts: 1, retryAfter: first.retry };
  await sleep(retryAfterMs(first.retry));
  const second = await once();
  return { status: second.status, body: second.body, attempts: 2, retryAfter: second.retry };
}

export type SendOpts = {
  env: Pick<MetrcEnv, "METRC_INTEGRATOR_KEY" | "METRC_USER_KEY" | "METRC_API_BASE" | "METRC_EVAL_ENABLED">;
  method: "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  userKey?: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
  clock?: () => number;
  record?: (row: CallRow) => Promise<void>;
};

export type SendResult = { sent: false; refusal: string } | { sent: true; status: number; body: unknown };

export const SEND_ON_PRODUCTION = "A production host never receives a write from this app.";
export const SEND_EVAL_OFF = "The evaluation switch is off, so nothing is sent to Metrc.";
export const SEND_METHOD_REFUSED = "Only POST, PUT and DELETE go through the write door.";

/** MA1 Law 3: why a write is refused, or null when it may be attempted. A
 * write goes only to a sandbox host and only with METRC_EVAL_ENABLED "true".
 * The smoke's stub (A32) is a sandbox for the page and the mode law only: the
 * write door reads the literal host and never opens to it. */
export function sendRefusal(env: Pick<MetrcEnv, "METRC_API_BASE" | "METRC_EVAL_ENABLED" | "METRC_STUB_BASE" | "METRC_STUB_ENABLED">): string | null {
  if (metrcStubBase(env)) return METRC_HOST_REFUSAL;
  const kind = metrcHostKind(env);
  if (kind === "production") return SEND_ON_PRODUCTION;
  if (kind !== "sandbox") return METRC_HOST_REFUSAL;
  if (env.METRC_EVAL_ENABLED !== "true") return SEND_EVAL_OFF;
  return null;
}

/** MA1 Law 3, for Phase E2 only (no caller yet). One attempt, recorded; a
 * write is never repeated by this code, a 429 included, and never follows a
 * redirect (a 307 would re-send the body elsewhere). A refusal makes no fetch
 * and records nothing; a path that leaves the sandbox origin is refused like
 * any other host. METRC_WRITE_ENABLED and testingPostRequest are not touched. */
export async function metrcSend(opts: SendOpts): Promise<SendResult> {
  const method = String(opts.method);
  if (method !== "POST" && method !== "PUT" && method !== "DELETE") return { sent: false, refusal: SEND_METHOD_REFUSED };
  const refusal = sendRefusal(opts.env);
  if (refusal) return { sent: false, refusal };
  const integrator = (opts.env.METRC_INTEGRATOR_KEY ?? "").trim();
  const user = (opts.userKey != null ? opts.userKey : opts.env.METRC_USER_KEY ?? "").trim();
  if (!integrator || !user) return { sent: false, refusal: absentWords({ integrator: integrator !== "", user: user !== "" }) };
  let url: URL;
  try {
    url = metrcUrl(opts.env, opts.path, opts.query);
  } catch {
    return { sent: false, refusal: METRC_HOST_REFUSAL };
  }
  const token = basicToken(integrator, user);
  if (!token) return { sent: false, refusal: KEY_CHARACTER_REFUSAL };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? nowIso;
  const clock = opts.clock ?? Date.now;
  const record = opts.record ?? (async () => undefined);
  const path = callPath(url.toString());
  const started = now();
  const t0 = clock();
  let status = 0;
  try {
    const res = await fetchImpl(url.toString(), {
      method,
      redirect: "manual",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Basic ${token}` },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    status = res.status;
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }
    return { sent: true, status, body };
  } catch (err) {
    throw new Error(scrubKeys(err instanceof Error ? err.message : String(err), [integrator, user, token]));
  } finally {
    await record({ started_at: started, path, status, ms: Math.max(0, clock() - t0) });
  }
}

type SweepRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  trigger: string;
  message: string | null;
  packages_seen: number | null;
  results_read: number | null;
  fields_written: number | null;
};

async function insertSweep(db: D1Database, row: SweepRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO metrc_sweeps (
        id, started_at, finished_at, status, trigger, message, packages_seen, results_read, fields_written
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(row.id, row.started_at, row.finished_at, row.status, row.trigger, row.message, row.packages_seen, row.results_read, row.fields_written)
    .run();
}

/** One metrc_api_calls row per HTTP attempt, with the host it was made on
 * (0098, A18: the month pace counts one host). Both sweeps and Test
 * connection record through this. */
async function recordCall(db: D1Database, row: CallRow, host: string | null = null): Promise<void> {
  await db
    .prepare(`INSERT INTO metrc_api_calls (id, started_at, path, status, ms, host) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), row.started_at, row.path, row.status, row.ms, host)
    .run();
}

/** One metrc_api_calls row per HTTP attempt (MA1 Law 5's pager records through this). */
export const recordMetrcCall = recordCall;

export function absentWords(keys: { integrator: boolean; user: boolean }): string {
  const parts: string[] = [];
  if (!keys.integrator) parts.push("The integrator key is absent.");
  if (!keys.user) parts.push("The user key is absent.");
  return parts.join(" ");
}

/** MA1 A7: the lab sweep's word on a sandbox host. */
export const SANDBOX_DESK_NOTE = "Sandbox host: nothing was written to the desk.";

/** The active lookup licenses the sweep reads (Admin\Data Lookups\Logistics\Licenses). */
export async function lookupLicenses(db: D1Database): Promise<string[]> {
  const licenses = await db
    .prepare(`SELECT value FROM lookup_values WHERE category = 'license' AND deleted_at IS NULL ORDER BY value`)
    .all<{ value: string }>();
  return (licenses.results ?? []).map((row) => row.value).filter(facilityLicense);
}

/** The lab sweep's reader, preserved by MA1 Law 5: 20 rows by 20 pages. A
 * second 429 (or any 4xx or 5xx but 401 and 403) still throws here and ends
 * the whole lab sweep, as before; only the new pager (metrcpager.ts) ends one
 * scope and carries on. The blank Retry-After fix of A9 is shared. A 3xx
 * (redirects are not followed) is a failure like a 4xx or 5xx. */
async function readPaged(opts: GetOpts & { query: Record<string, string> }): Promise<{ rows: unknown[]; refused: boolean }> {
  const rows: unknown[] = [];
  let page = 1;
  for (let i = 0; i < METRC_MAX_PAGES; i++) {
    const res = await metrcGet({ ...opts, query: { ...opts.query, pageNumber: String(page), pageSize: String(METRC_PAGE_SIZE) } });
    if (res.status === 401 || res.status === 403) return { rows, refused: true };
    if (res.status >= 300 || res.status === 0) throw new Error(`Metrc answered ${res.status}.`);
    const parsed = pageData(res.body);
    rows.push(...parsed.rows);
    if (parsed.rows.length < METRC_PAGE_SIZE) break;
    if (parsed.totalPages != null && page >= parsed.totalPages) break;
    page += 1;
  }
  return { rows, refused: false };
}

function packageId(pkg: unknown): string | null {
  if (!pkg || typeof pkg !== "object") return null;
  return textOf((pkg as { Id?: unknown }).Id);
}

function packageLabel(pkg: unknown): string | null {
  if (!pkg || typeof pkg !== "object") return null;
  return textOf((pkg as { Label?: unknown }).Label);
}

async function rowsForLabels(db: D1Database, labels: string[]): Promise<{ samples: SampleMirror[]; orders: OrderMirror[] }> {
  const samples: SampleMirror[] = [];
  const orders: OrderMirror[] = [];
  for (let i = 0; i < labels.length; i += 80) {
    const chunk = labels.slice(i, i + 80);
    const marks = chunk.map(() => "?").join(",");
    const sampleRows = await db
      .prepare(
        `SELECT id, sample_tag, metrc_lab_testing_state, metrc_state_date, metrc_result_id, coa_file_id, overall_passed, thc_total_pct
         FROM test_samples WHERE deleted_at IS NULL AND sample_tag IN (${marks})`
      )
      .bind(...chunk)
      .all<SampleMirror>();
    const orderRows = await db
      .prepare(
        `SELECT id, source_package_tag, metrc_lab_testing_state, metrc_state_date
         FROM test_orders WHERE deleted_at IS NULL AND source_package_tag IN (${marks})`
      )
      .bind(...chunk)
      .all<OrderMirror>();
    for (const row of sampleRows.results ?? []) {
      samples.push({
        ...row,
        overall_passed: row.overall_passed == null ? null : Number(row.overall_passed),
        thc_total_pct: row.thc_total_pct == null ? null : Number(row.thc_total_pct),
      });
    }
    orders.push(...(orderRows.results ?? []));
  }
  return { samples, orders };
}

async function applyChanges(db: D1Database, changes: FieldChange[], at: string): Promise<void> {
  if (changes.length === 0) return;
  const byId = new Map<string, FieldChange[]>();
  for (const change of changes) {
    const key = `${change.table}:${change.id}`;
    const list = byId.get(key) ?? [];
    list.push(change);
    byId.set(key, list);
  }
  const stmts: D1PreparedStatement[] = [];
  for (const [key, list] of byId) {
    const [table, id] = key.split(":");
    const sets = list.map((change) => `${change.field} = ?`);
    stmts.push(
      db.prepare(`UPDATE ${table} SET ${sets.join(", ")}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`).bind(...list.map((change) => change.new_value), at, id)
    );
    for (const change of list) {
      stmts.push(
        insertLog(db, {
          record_table: table,
          record_id: id,
          field: change.field,
          old_value: change.old_value,
          new_value: change.new_value,
          actor_person_id: null,
          reason: SYSTEM_REASON.metrc_mirror,
          changed_at: at,
        })
      );
    }
  }
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
}

/** The hourly read. Absent keys record a skipped sweep and make no call. */
export async function runMetrcSweep(env: MetrcEnv, trigger: MetrcTrigger): Promise<void> {
  const started = nowIso();
  try {
    const keys = keysPresent(env);
    if (!keys.integrator || !keys.user) {
      await insertSweep(env.DB, {
        id: crypto.randomUUID(),
        started_at: started,
        finished_at: nowIso(),
        status: "skipped",
        trigger,
        message: absentWords(keys),
        packages_seen: 0,
        results_read: 0,
        fields_written: 0,
      });
      return;
    }
    // MA1 Law 3 (A8): keys never go to a host that is not a Metrc host.
    const hostKind = metrcHostKind(env);
    if (hostKind === "other") {
      await insertSweep(env.DB, {
        id: crypto.randomUUID(),
        started_at: started,
        finished_at: nowIso(),
        status: "failed",
        trigger,
        message: METRC_HOST_REFUSAL,
        packages_seen: 0,
        results_read: 0,
        fields_written: 0,
      });
      return;
    }
    const facilities = await lookupLicenses(env.DB);
    const window = modifiedWindow(Date.now());
    const host = metrcHost(env);
    const getOpts = {
      env,
      fetchImpl: fetch,
      record: (row: CallRow) => recordCall(env.DB, row, host),
    };
    const byLabel = new Map<string, { pkg: unknown; license: string }>();
    let refused = 0;
    for (const license of facilities) {
      for (const path of ["/packages/v2/labsamples", "/packages/v2/active"]) {
        const page = await readPaged({
          ...getOpts,
          path,
          query: { licenseNumber: license, lastModifiedStart: window.start, lastModifiedEnd: window.end },
        });
        if (page.refused) {
          refused += 1;
          break;
        }
        for (const pkg of page.rows) {
          const label = packageLabel(pkg);
          if (label) byLabel.set(label, { pkg, license });
        }
      }
    }
    const known = await rowsForLabels(env.DB, [...byLabel.keys()]);
    const sampleTags = new Set(known.samples.map((row) => row.sample_tag));
    const resultsByLabel = new Map<string, unknown[]>();
    let resultsRead = 0;
    for (const [label, seen] of byLabel) {
      if (!sampleTags.has(label)) continue;
      const id = packageId(seen.pkg);
      if (!id) continue;
      const page = await readPaged({ ...getOpts, path: "/labtests/v2/results", query: { packageId: id, licenseNumber: seen.license } });
      if (page.refused) {
        refused += 1;
        continue;
      }
      resultsByLabel.set(label, page.rows);
      resultsRead += page.rows.length;
    }
    const changes = mirrorChanges({
      samples: known.samples,
      orders: known.orders,
      packages: [...byLabel.values()].map((seen) => seen.pkg),
      resultsByLabel,
    });
    const finished = nowIso();
    // MA1 A7 (Law 3): sandbox data never reaches the desk. On a sandbox host
    // the sweep reads as before and writes nothing to test_samples or test_orders.
    const sandbox = hostKind === "sandbox";
    if (!sandbox) await applyChanges(env.DB, changes, finished);
    const wrotePackageState = !sandbox && changes.some((change) => (change.table as string) === "metrc_packages" && change.field === "lab_test_status");
    const releaseNote = wrotePackageState ? null : "No mirror package lab status was written, so nothing was released from the Testing Queue.";
    if (wrotePackageState) await releaseTestedFromMirror(env.DB, null, crypto.randomUUID(), finished);
    const allRefused = facilities.length > 0 && refused > 0 && byLabel.size === 0;
    const baseMessage = facilities.length === 0 ? "No facility licenses." : allRefused ? "Metrc refused the keys." : refused > 0 ? "Metrc refused one facility." : null;
    await insertSweep(env.DB, {
      id: crypto.randomUUID(),
      started_at: started,
      finished_at: finished,
      status: allRefused ? "failed" : "ok",
      trigger,
      message: [baseMessage, sandbox ? SANDBOX_DESK_NOTE : null, releaseNote].filter(Boolean).join(" ") || null,
      packages_seen: byLabel.size,
      results_read: resultsRead,
      fields_written: sandbox ? 0 : changes.length,
    });
  } catch (err) {
    const integrator = (env.METRC_INTEGRATOR_KEY ?? "").trim();
    const user = (env.METRC_USER_KEY ?? "").trim();
    const message = scrubKeys(err instanceof Error ? err.message : String(err), [integrator, user, basicToken(integrator, user)]);
    try {
      await insertSweep(env.DB, {
        id: crypto.randomUUID(),
        started_at: started,
        finished_at: nowIso(),
        status: "failed",
        trigger,
        message: message || "Metrc did not answer.",
        packages_seen: null,
        results_read: null,
        fields_written: null,
      });
    } catch {
      // The sheet sync shares this cron. A failed sweep must not fail that run.
    }
  }
}

export type ConnectionResult = { code: "absent" | "connected" | "refused" | "failed" | "host"; n: number; reached: number; of: number };

/** One facility of GET /facilities/v2/, the keep-list only (MA1 A33, D14):
 * License.Number, License.LicenseType and three FacilityType flags
 * (GET_facilities_v2.txt). Never EmployeeLicenseNumber, FacilityId or a
 * person field. */
export type FacilityFacts = {
  license: string;
  licenseType: string | null;
  canGrowPlants: number | null;
  canRecordProcessingJobs: number | null;
  canTrackVegetativePlants: number | null;
};

function flagOf(value: unknown): number | null {
  return typeof value === "boolean" ? (value ? 1 : 0) : null;
}

export function parseFacilities(body: unknown): FacilityFacts[] {
  const list = Array.isArray(body) ? body : pageData(body).rows;
  const out: FacilityFacts[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const license = (item as { License?: unknown }).License;
    const type = (item as { FacilityType?: unknown }).FacilityType;
    const number = license && typeof license === "object" ? textOf((license as { Number?: unknown }).Number) : null;
    if (!number || seen.has(number.toUpperCase())) continue;
    seen.add(number.toUpperCase());
    const flags = type && typeof type === "object" ? (type as Record<string, unknown>) : {};
    out.push({
      license: number,
      licenseType: license && typeof license === "object" ? textOf((license as { LicenseType?: unknown }).LicenseType) : null,
      canGrowPlants: flagOf(flags.CanGrowPlants),
      canRecordProcessingJobs: flagOf(flags.CanRecordProcessingJobs),
      canTrackVegetativePlants: flagOf(flags.CanTrackVegetativePlants),
    });
  }
  return out;
}

export type FacilityReachRow = {
  host: string;
  license_value: string;
  in_lookup: number;
  reached: number;
  can_grow_plants: number | null;
  can_record_processing_jobs: number | null;
  can_track_vegetative_plants: number | null;
  license_type: string | null;
  checked_at: string;
};

/** MA1 A22: Test connection per license is one facilities call matched on
 * License.Number. Every lookup license gets a row (reached 1 or 0); every
 * facility the key reaches outside the lookup gets one too (in_lookup 0),
 * for the sandbox's generic facilities (A5). */
export function facilityReach(lookup: string[], facilities: FacilityFacts[], host: string, at: string): FacilityReachRow[] {
  const byNumber = new Map(facilities.map((facility) => [facility.license.trim().toUpperCase(), facility]));
  const inLookup = new Set<string>();
  const rows: FacilityReachRow[] = [];
  for (const license of lookup) {
    const key = license.trim().toUpperCase();
    if (inLookup.has(key)) continue;
    inLookup.add(key);
    const hit = byNumber.get(key) ?? null;
    rows.push({
      host,
      license_value: license,
      in_lookup: 1,
      reached: hit ? 1 : 0,
      can_grow_plants: hit?.canGrowPlants ?? null,
      can_record_processing_jobs: hit?.canRecordProcessingJobs ?? null,
      can_track_vegetative_plants: hit?.canTrackVegetativePlants ?? null,
      license_type: hit?.licenseType ?? null,
      checked_at: at,
    });
  }
  for (const facility of facilities) {
    if (inLookup.has(facility.license.trim().toUpperCase())) continue;
    rows.push({
      host,
      license_value: facility.license,
      in_lookup: 0,
      reached: 1,
      can_grow_plants: facility.canGrowPlants,
      can_record_processing_jobs: facility.canRecordProcessingJobs,
      can_track_vegetative_plants: facility.canTrackVegetativePlants,
      license_type: facility.licenseType,
      checked_at: at,
    });
  }
  return rows;
}

const FACILITY_COLUMNS = [
  "host",
  "license_value",
  "in_lookup",
  "reached",
  "can_grow_plants",
  "can_record_processing_jobs",
  "can_track_vegetative_plants",
  "license_type",
  "checked_at",
] as const;

/** One batch: this host's earlier rows read not reached, then every row of
 * this check is upserted (ten rows, ninety binds, per statement). */
async function writeFacilityReach(db: D1Database, host: string, rows: FacilityReachRow[], at: string): Promise<void> {
  const stmts: D1PreparedStatement[] = [db.prepare(`UPDATE metrc_facilities SET reached = 0, checked_at = ? WHERE host = ?`).bind(at, host)];
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10);
    const marks = chunk.map(() => `(${FACILITY_COLUMNS.map(() => "?").join(", ")})`).join(", ");
    stmts.push(
      db
        .prepare(
          `INSERT INTO metrc_facilities (${FACILITY_COLUMNS.join(", ")}) VALUES ${marks}
           ON CONFLICT (host, license_value) DO UPDATE SET
             in_lookup = excluded.in_lookup,
             reached = excluded.reached,
             can_grow_plants = excluded.can_grow_plants,
             can_record_processing_jobs = excluded.can_record_processing_jobs,
             can_track_vegetative_plants = excluded.can_track_vegetative_plants,
             license_type = excluded.license_type,
             checked_at = excluded.checked_at`
        )
        .bind(...chunk.flatMap((row) => FACILITY_COLUMNS.map((column) => row[column])))
    );
  }
  await db.batch(stmts);
}

export async function testMetrcConnection(env: MetrcEnv): Promise<ConnectionResult> {
  const keys = keysPresent(env);
  if (!keys.integrator || !keys.user) return { code: "absent", n: 0, reached: 0, of: 0 };
  if (metrcHostKind(env) === "other") return { code: "host", n: 0, reached: 0, of: 0 };
  try {
    const res = await metrcGet({
      env,
      path: "/facilities/v2",
      record: (row) => recordCall(env.DB, row, metrcHost(env)),
    });
    if (res.status === 401 || res.status === 403) return { code: "refused", n: 0, reached: 0, of: 0 };
    if (res.status >= 300 || res.status === 0) return { code: "failed", n: 0, reached: 0, of: 0 };
    const host = metrcHost(env);
    const at = nowIso();
    const lookup = await lookupLicenses(env.DB);
    const rows = facilityReach(lookup, parseFacilities(res.body), host, at);
    await writeFacilityReach(env.DB, host, rows, at);
    const reached = rows.filter((row) => row.in_lookup === 1 && row.reached === 1).length;
    return { code: "connected", n: facilityCount(res.body), reached, of: rows.filter((row) => row.in_lookup === 1).length };
  } catch {
    return { code: "failed", n: 0, reached: 0, of: 0 };
  }
}

export type LicenseReach = "reached" | "not_reached" | "unchecked";

/** MA1 A33: the FacilityType flags of a license, from metrc_facilities. */
export type MetrcFacilityFlags = {
  canGrowPlants: number | null;
  canRecordProcessingJobs: number | null;
  canTrackVegetativePlants: number | null;
  licenseType: string | null;
};

export type MetrcLicenseLine = {
  license: string;
  reach: LicenseReach;
  /** Law 4, per license: the single user key covers it (A4), or is absent. */
  keyPresent?: boolean;
  /** Null once checked and not reached; undefined before any check. */
  flags?: MetrcFacilityFlags | null;
};

/** Law 9, section 1: the host's kind and the configured against the resolved mode. */
export type MetrcModeLine = { hostKind: MetrcHostKind; configured: string; resolved: SweepMode; refusal: string | null };

/** Law 9, section 3: the month pace as the pager computes it (A17). */
export type MetrcBudgetLine = { monthCalls: number; remaining: number; nextTickCalls: number; ticksLeft: number; tickCalls: number; sweepNowCalls: number };

export type MetrcCursorLine = {
  id: string;
  mode: string;
  hwm_end: string | null;
  full_pass_id: string | null;
  full_page: number;
  full_total_pages: number | null;
  full_completed_at: string | null;
  full_due_at: string | null;
  gone_override: number;
  last_status: string | null;
  last_run_at: string | null;
  failures: number;
};

export type MetrcRunLine = {
  id: string;
  started_at: string;
  run_kind: string;
  mode: string;
  rows: number | null;
  calls: number | null;
  failures: number | null;
  status: string;
  message: string | null;
  would_gone: number | null;
  gone_held: number;
};

/** Law 9, section 4: one line per license and endpoint of the mirror sweep. */
export type MetrcEndpointLine = {
  license: string;
  endpoint: string;
  kind: string;
  phase: string | null;
  /** The resolved mode's live cursor of this scope on this host (A26), else null. */
  cursor: MetrcCursorLine | null;
  /** The latest run of this scope on this host, any kind and mode. */
  run: MetrcRunLine | null;
  /** The rows the latest complete full pass of the resolved mode would have
   * marked gone while the guard held them (A29), else null; the hold outlives
   * the incrementals that follow it until the next complete pass. */
  heldGone: number | null;
  /** The id of that held pass, carried by the Confirm gone form. */
  heldRun: string | null;
  /** A sentence that stands for a run the sweep has not made yet (a license
   * whose plants and harvests wait for Test connection), else null. */
  note: string | null;
};

export type MetrcParityRun = { endpoint: string; run_kind: string; started_at: string; would_add: number; would_update: number; would_gone: number; gone_held: number };
export type MetrcParitySample = { endpoint: string; tag: string; column: string; mirrorValue: string | null; apiValue: string | null; crewMove: boolean };
export type MetrcParityMount = { kind: string; phase: string | null; created_at: string; ageHours: number };
export type MetrcParityVerdict = "clean" | "differs" | "none";

/** Law 9, section 6: one license of the parity pane (production dry runs only). */
export type MetrcParityLine = {
  license: string;
  runs: MetrcParityRun[];
  samples: MetrcParitySample[];
  mounts: MetrcParityMount[];
  verdict: MetrcParityVerdict;
  totals: { add: number; update: number; gone: number; held: number; samples: number };
};

export type MetrcAdmin = {
  integrator: boolean;
  user: boolean;
  host: string;
  calls: number;
  sweep: SweepRow | null;
  /** MA1 A22: per lookup license, from metrc_facilities for this host. */
  licenses?: MetrcLicenseLine[];
  /** Facilities the key reaches outside the license lookup. */
  otherFacilities?: number;
  /** MA1 Phase D (Law 9): filled by loadMetrcAdminPage (metrcadmin.ts). */
  mode?: MetrcModeLine;
  budget?: MetrcBudgetLine;
  endpoints?: MetrcEndpointLine[];
  sweepLicenses?: string[];
  sweepEndpoints?: string[];
  parity?: MetrcParityLine[];
};

function flagOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function loadMetrcAdmin(env: MetrcEnv): Promise<MetrcAdmin> {
  const keys = keysPresent(env);
  const month = nowIso().slice(0, 7);
  const host = metrcHost(env);
  // MA1 A18: "Calls this month" counts the current host only (rows written
  // before 0098 carry no host and are counted, the conservative reading).
  const [calls, sweep, lookup, reach] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM metrc_api_calls WHERE started_at >= ? AND (host = ? OR host IS NULL)`).bind(`${month}-01`, host).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT id, started_at, finished_at, status, trigger, message, packages_seen, results_read, fields_written
       FROM metrc_sweeps ORDER BY started_at DESC LIMIT 1`
    ).first<SweepRow>(),
    lookupLicenses(env.DB),
    env.DB.prepare(
      `SELECT license_value, reached, can_grow_plants, can_record_processing_jobs, can_track_vegetative_plants, license_type FROM metrc_facilities WHERE host = ?`
    )
      .bind(host)
      .all<{ license_value: string; reached: number; can_grow_plants: unknown; can_record_processing_jobs: unknown; can_track_vegetative_plants: unknown; license_type: string | null }>(),
  ]);
  // One license may be stored in two letter cases (a facility row from a check
  // made while its lookup row was deleted). A reached row wins, so a stale row
  // in another case never hides the license's current reach; its flags are the
  // reached row's (Law 9 shows them per license).
  const byLicense = new Map<string, { reached: number; flags: MetrcFacilityFlags }>();
  for (const row of reach.results ?? []) {
    const key = String(row.license_value).trim().toUpperCase();
    const reached = Number(row.reached) === 1 ? 1 : 0;
    const flags: MetrcFacilityFlags = {
      canGrowPlants: flagOrNull(row.can_grow_plants),
      canRecordProcessingJobs: flagOrNull(row.can_record_processing_jobs),
      canTrackVegetativePlants: flagOrNull(row.can_track_vegetative_plants),
      licenseType: row.license_type ?? null,
    };
    const prior = byLicense.get(key);
    if (!prior || (reached === 1 && prior.reached === 0)) byLicense.set(key, { reached, flags });
  }
  const lookupKeys = new Set(lookup.map((license) => license.trim().toUpperCase()));
  const licenses: MetrcLicenseLine[] = lookup.map((license) => {
    const hit = byLicense.get(license.trim().toUpperCase());
    const state: LicenseReach = hit == null ? "unchecked" : hit.reached === 1 ? "reached" : "not_reached";
    return { license, reach: state, keyPresent: userKeyFor(env, license) != null, flags: hit == null ? undefined : hit.reached === 1 ? hit.flags : null };
  });
  let otherFacilities = 0;
  for (const [license, row] of byLicense) if (row.reached === 1 && !lookupKeys.has(license)) otherFacilities += 1;
  return {
    integrator: keys.integrator,
    user: keys.user,
    host,
    calls: Number(calls?.n ?? 0),
    sweep: sweep ?? null,
    licenses,
    otherFacilities,
  };
}

const LICENSE_REACH_HELP = "Whether the user key reaches this license in Metrc, from the last Test connection. A license the key does not reach cannot be swept. Admin\\Data Lookups\\Logistics\\Licenses";
const OTHER_FACILITIES_HELP = "Facilities the user key reaches that are not in the license lookup, such as a sandbox's generic facilities. They are counted, never swept. Admin\\Data Lookups\\Logistics\\Licenses";
const REACH_WORDS: Record<LicenseReach, string> = {
  reached: "Reached by this key",
  not_reached: "Not reached by this key",
  unchecked: "Not checked yet",
};

// MA1 Phase D, Law 9: the hover help (what each field impacts and its lookup
// path, Admin\Data Lookups\<Category>\<Field>), one line per element kind.
const HELP_PAGE =
  "MA1, the METRC API read integration: the keys' presence, the host and mode, the month's calls, every scope's cursor and last run, Sweep now, and the parity pane that decides when dry_run may become write. Reads only; nothing here writes to Metrc and no key reaches this page.";
const HELP_HOST =
  "The METRC host this app calls (METRC_API_BASE in wrangler.toml) and its kind, sandbox or production. Keys go only to a Metrc host; a sandbox host runs dry runs only and sandbox data never enters the live mirror.";
const HELP_MODE =
  "The sweep mode as configured (metrc_sweep_mode: off, dry_run or write) and as the host law resolves it; when the two differ the refusal says why. write runs only on a production host and the code never promotes itself. The mode is changed only in Admin Lookups, never on this page. Admin\\Data Lookups\\People and System\\App config";
const HELP_KEYS =
  "Whether each wrangler secret is set, presence only; the value never reaches a page. The one user key covers every license (A4), so each license reads key present or key absent, with the reach of the last Test connection and the FacilityType flags Metrc reports. Admin\\Data Lookups\\Logistics\\Licenses";
const HELP_KEY = "Whether this wrangler secret is set, presence only; the value never reaches a page. With a key absent, Test connection and Sweep now make no call.";
const HELP_FLAGS =
  "The FacilityType flags from the last Test connection (CanGrowPlants, CanRecordProcessingJobs, CanTrackVegetativePlants): a license that cannot grow plants is swept for packages only. Admin\\Data Lookups\\Logistics\\Licenses";
const HELP_TEST = "One GET /facilities/v2 with the keys: Connected with the count, refused, failed or absent. It refreshes each license's reach and FacilityType flags for this host.";
const HELP_CALLS =
  "METRC calls this UTC month on this host, the lab sweep's included, against the month ceiling (metrc_month_calls, a pace and never a stop), what the pace leaves the next tick (never above metrc_tick_calls) and the calls one Sweep now may spend (metrc_sweep_now_calls). Admin\\Data Lookups\\People and System\\App config";
const HELP_ENDPOINTS =
  "One row per license and endpoint the mirror sweep reads, plus the lab sweep: the last run (Eastern), its kind, rows read, calls, failures, the status word, the cursor's high-water mark and full-pass progress, and the gone hold. Cadences and budgets are app_config keys. Admin\\Data Lookups\\People and System\\App config";
const HELP_STATUS =
  "The status of this scope's last run. ok: read whole. budget: the tick's budget ran out and the cursor was saved where it stands. refused: Metrc refused the license. retry_after: Metrc asked for a wait. window_too_wide: the window is being halved. gone_held: the gone marks wait for Confirm gone. short: a page came back with 0 rows before TotalPages, so the scope re-reads that page every tick until Metrc answers rows or a person resets the cursor. ceiling: the page ceiling was reached, the pass is dropped and is due again at its cadence. mode_refused: write was asked on a host that is not production. skipped: nothing was read.";
const HELP_CURSOR =
  "The cursor of this scope in the resolved mode (each mode keeps its own, A26): the lastModified high-water mark the incrementals read from, and the full pass in progress (its page of its total pages), when the last pass completed and when the next is due by its cadence (metrc_full_packages_hours, metrc_full_harvests_hours, metrc_full_plants_hours). Admin\\Data Lookups\\People and System\\App config";
const HELP_GONE_HELD =
  "The mass-gone guard (A29) held this scope's gone marks: the pass read too few rows against the live rows, or would mark more than metrc_gone_hold_share of them. Confirm gone lets the next complete pass mark them once. Admin\\Data Lookups\\People and System\\App config";
const HELP_CONFIRM_GONE =
  "Sets gone_override on this cursor: the next complete full pass marks its would-gone rows gone without the mass-gone guard (A29), once, then the override resets. Nothing is marked until that pass completes; in dry_run nothing is marked at all.";
const HELP_RESET_CURSOR =
  "Soft-deletes this cursor and its pass pages with a logged reason, so the next tick starts a fresh full pass for the scope: the remedy for a scope stuck on short or ceiling. The run log stays.";
const HELP_SWEEP_NOW =
  "Runs one license and endpoint of the mirror sweep now, inline, in the resolved mode, within metrc_sweep_now_calls (A20) and the month pace; refused in plain words, with no call, when a key is absent, the host is not a Metrc host, or the mode is off. Admin\\Data Lookups\\People and System\\App config";
const HELP_SWEEP_NOW_LICENSE =
  "The license to sweep now, from the license lookup; a license the key does not reach, or an endpoint the license is not swept for, is refused by the sweep. Admin\\Data Lookups\\Logistics\\Licenses";
const HELP_PARITY =
  "Per license, the latest dry-run runs on the production host only (sandbox runs are never parity evidence): would-add, would-update, would-gone and the gone hold, the sample differences (tag, column, mirror value, API value; a location difference is a crew move when the tag changed after its mount), next to the age of the latest CSV mount per kind. Parity reads clean only when every count is 0 and no sample differs. Moving dry_run to write is the owner's word after reading this pane.";
const HELP_MOUNT_AGE = "The newest file (CSV) mount of this license per kind and phase, and its age: parity compares the API against the mirror the drops last wrote.";
const HELP_LAB_SWEEP =
  "The hourly lab sweep (15 past the hour): lab samples and active packages of the last hour plus five minutes, filling only blank desk columns; preserved by Law 5. Its words are stored in English and shown in the page's language.";
const HELP_WRITE = "The write switch of the testing POST (METRC_WRITE_ENABLED), off: nothing in this app POSTs to Metrc outside the evaluation runner's sandbox door.";
const HELP_FLASH = "The outcome of the last button: Test connection, Sweep now, Confirm gone or Reset cursor.";

/** The status words of the cursor's last_status and the run rows, EN keys. */
export const METRC_STATUS_WORDS: Record<string, string> = {
  ok: "ok",
  refused: "refused",
  failed: "failed",
  budget: "budget",
  retry_after: "retry after",
  window_too_wide: "window too wide",
  gone_held: "gone held",
  short: "short",
  ceiling: "ceiling",
  mode_refused: "mode refused",
  skipped: "skipped",
  host_refused: "host refused",
  rate_limited: "rate limited",
  needs_full: "needs full pass",
  absent: "absent",
};
export const METRC_RUN_KIND_WORDS: Record<string, string> = {
  incremental: "incremental run",
  full: "full pass",
  tick: "tick",
  lab: "lab sweep",
};
export const METRC_HOST_KIND_WORDS: Record<MetrcHostKind, string> = {
  sandbox: "sandbox",
  production: "production",
  other: "not a Metrc host",
};
/** The flash words of the Phase D buttons; the Phase B codes keep their chain. */
export const METRC_FLASH_WORDS: Record<string, { cls: "ok" | "err"; key: string }> = {
  swept: { cls: "ok", key: "Sweep now ran: {n} calls." },
  sweep_absent: { cls: "err", key: "Sweep now made no call: a key is absent." },
  sweep_host: { cls: "err", key: METRC_HOST_REFUSAL },
  sweep_off: { cls: "err", key: "Sweep now refused: the sweep mode is off." },
  sweep_unknown: { cls: "err", key: "Sweep now names a license or endpoint this sweep does not read." },
  sweep_failed: { cls: "err", key: "Sweep now failed; the run row says why." },
  gone_confirmed: { cls: "ok", key: "Gone confirmed: the next complete pass marks without the guard, once." },
  gone_unknown: { cls: "err", key: "That cursor was not found on this host." },
  gone_not_held: { cls: "err", key: "Nothing is held for that cursor now; read the page again." },
  cursor_reset: { cls: "ok", key: "Cursor reset: the next tick starts a fresh full pass." },
  cursor_unknown: { cls: "err", key: "That cursor was not found on this host." },
};

/** A word from a plain-object table, own keys only (a code such as
 * "constructor" from the query string must not read the prototype). */
function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

function statusWord(locale: Locale, code: string | null): string {
  if (!code) return "";
  const key = own(METRC_STATUS_WORDS, code);
  return key ? t(locale, key) : code;
}

function help(locale: Locale, text: string): string {
  return ` title="${esc(t(locale, text))}"`;
}

function stamp(iso: string | null): string {
  return iso ? easternStamp(iso) : "";
}

function flagText(value: number | null): string {
  return value == null ? "-" : String(value);
}

/** The sweep's and the pager's sentences that carry a number: each matches a
 * dictionary line with holes (metrcsweep.ts sweepScope, metrcpager.ts readPage). */
const STORED_TEMPLATES: readonly { re: RegExp; key: string; holes: readonly string[] }[] = [
  { re: /^(\d+) rows named another GrowthPhase than the list's\.$/, key: "{n} rows named another GrowthPhase than the list's.", holes: ["n"] },
  { re: /^(\d+) inactive harvests outside the (\d+)-day scope were not written\.$/, key: "{n} inactive harvests outside the {d}-day scope were not written.", holes: ["n", "d"] },
  { re: /^Metrc answered (\d+)\.$/, key: "Metrc answered {s}.", holes: ["s"] },
];

function storedSentence(locale: Locale, sentence: string): string {
  for (const template of STORED_TEMPLATES) {
    const hit = sentence.match(template.re);
    if (!hit) continue;
    const vars: Record<string, string> = {};
    template.holes.forEach((hole, i) => {
      vars[hole] = hit[i + 1];
    });
    return tFill(locale, template.key, vars);
  }
  return t(locale, sentence);
}

/** A stored sweep message is English sentences joined by spaces. The whole
 * message reads its dictionary line when it has one (a refusal of two
 * sentences is one line); otherwise each sentence reads its own, a counted
 * sentence through its template, so the Spanish page shows the sweep's words
 * in Spanish; a sentence with no line (a scrubbed error) stays as stored. */
export function storedWords(locale: Locale, message: string): string {
  if (locale === "en") return message;
  const whole = t(locale, message);
  if (whole !== message) return whole;
  return message
    .split(/(?<=\.)\s+/)
    .map((sentence) => storedSentence(locale, sentence))
    .join(" ");
}

function modeSection(data: MetrcAdmin, locale: Locale): string {
  const mode = data.mode;
  const hostHelp = help(locale, HELP_HOST);
  const modeHelp = help(locale, HELP_MODE);
  const kind = mode ? ` (${esc(t(locale, METRC_HOST_KIND_WORDS[mode.hostKind]))})` : "";
  const line = mode
    ? `<p data-metrc-mode-line${modeHelp}>${esc(tFill(locale, "Configured mode: {c}; resolved mode: {r}.", { c: mode.configured, r: mode.resolved }))}</p>${
        mode.refusal ? `<p class="muted" data-metrc-mode-refusal${modeHelp}>${esc(storedWords(locale, mode.refusal))}</p>` : ""
      }`
    : "";
  return `<section data-metrc-mode="${esc(mode?.resolved ?? "")}" data-metrc-mode-configured="${esc(mode?.configured ?? "")}" data-metrc-host-kind="${esc(mode?.hostKind ?? "")}"${hostHelp}>
      <h2${hostHelp}>${esc(t(locale, "Host and mode"))}</h2>
      <p data-metrc-base="${esc(data.host)}"${hostHelp}>${esc(t(locale, "Base"))}: ${esc(data.host)}${kind}</p>
      ${line}
    </section>`;
}

function keysSection(data: MetrcAdmin, locale: Locale): string {
  const keysHelp = help(locale, HELP_KEYS);
  const keyHelp = help(locale, HELP_KEY);
  const keyLine = (name: "integrator" | "user", present: boolean) =>
    `<p data-metrc-${name}="${present ? "present" : "absent"}"${keyHelp}>${esc(t(locale, name === "integrator" ? "Integrator key" : "User key"))}: ${esc(
      t(locale, present ? "present" : "absent")
    )}</p>`;
  const reachHelp = help(locale, LICENSE_REACH_HELP);
  const flagsHelp = help(locale, HELP_FLAGS);
  const items = (data.licenses ?? [])
    .map((row) => {
      const key = row.keyPresent == null ? "" : `; ${esc(t(locale, row.keyPresent ? "key present" : "key absent"))}`;
      const flags =
        row.flags === undefined
          ? ""
          : row.flags === null
            ? `; ${esc(t(locale, "flags not checked"))}`
            : `; ${esc(
                tFill(locale, "flags: CanGrowPlants {g}, CanRecordProcessingJobs {p}, CanTrackVegetativePlants {v}", {
                  g: flagText(row.flags.canGrowPlants),
                  p: flagText(row.flags.canRecordProcessingJobs),
                  v: flagText(row.flags.canTrackVegetativePlants),
                })
              )}`;
      const keyAttr = row.keyPresent == null ? "" : ` data-metrc-key="${row.keyPresent ? "present" : "absent"}"`;
      const flagAttr = row.flags ? ` data-metrc-flags="${flagText(row.flags.canGrowPlants)},${flagText(row.flags.canRecordProcessingJobs)},${flagText(row.flags.canTrackVegetativePlants)}"` : "";
      return `<li data-metrc-license="${esc(row.license)}" data-metrc-reach="${row.reach}"${keyAttr}${flagAttr}${row.flags ? flagsHelp : reachHelp}>${esc(row.license)}: ${esc(
        t(locale, REACH_WORDS[row.reach])
      )}${key}${flags}</li>`;
    })
    .join("");
  const other = data.otherFacilities ?? 0;
  const testHelp = help(locale, HELP_TEST);
  return `<section data-metrc-keys${keysHelp}>
      <h2${keysHelp}>${esc(t(locale, "Keys"))}</h2>
      ${keyLine("integrator", data.integrator)}
      ${keyLine("user", data.user)}
      <section data-metrc-reach-list${reachHelp}>
        <h2${reachHelp}>${esc(t(locale, "License reach"))}</h2>
        <ul${reachHelp}>${items}</ul>
        <p data-metrc-other-facilities="${other}"${help(locale, OTHER_FACILITIES_HELP)}>${esc(tFill(locale, "Other facilities this key reaches: {n}", { n: String(other) }))}</p>
      </section>
      <form method="post" action="${ADMIN_METRC_API_PATH}/test"${testHelp}>
        <button type="submit" data-metrc-test${testHelp}>${esc(t(locale, "Test connection"))}</button>
      </form>
    </section>`;
}

function callsSection(data: MetrcAdmin, locale: Locale): string {
  const callsHelp = help(locale, HELP_CALLS);
  const budget = data.budget;
  const pace = budget
    ? `<p data-metrc-month-ceiling="${budget.monthCalls}" data-metrc-remaining="${budget.remaining}" data-metrc-next-tick="${budget.nextTickCalls}" data-metrc-sweep-now-calls="${budget.sweepNowCalls}"${callsHelp}>${esc(
        tFill(locale, "Month ceiling: {m}; remaining: {r}; next tick: {t} calls ({k} ticks left); Sweep now: {s} calls.", {
          m: String(budget.monthCalls),
          r: String(budget.remaining),
          t: String(budget.nextTickCalls),
          k: String(budget.ticksLeft),
          s: String(budget.sweepNowCalls),
        })
      )}</p>`
    : "";
  return `<section data-metrc-budget${callsHelp}>
      <h2${callsHelp}>${esc(t(locale, "Calls"))}</h2>
      <p data-metrc-calls="${esc(String(data.calls))}"${callsHelp}>${esc(t(locale, "Calls this month"))}: ${esc(String(data.calls))}</p>
      ${pace}
    </section>`;
}

function fullPassWords(locale: Locale, c: MetrcCursorLine): string {
  const parts: string[] = [];
  if (c.full_pass_id) parts.push(tFill(locale, "page {p} of {t}", { p: String(c.full_page), t: c.full_total_pages == null ? "?" : String(c.full_total_pages) }));
  if (c.full_completed_at) parts.push(tFill(locale, "completed {at}", { at: stamp(c.full_completed_at) }));
  if (c.full_due_at) parts.push(tFill(locale, "due {at}", { at: stamp(c.full_due_at) }));
  if (parts.length === 0) parts.push(t(locale, "no pass yet"));
  return parts.join("; ");
}

function cursorForm(locale: Locale, action: string, cursorId: string, hook: string, label: string, helpText: string, runId: string | null = null): string {
  const h = help(locale, helpText);
  const run = runId ? `<input type="hidden" name="run" value="${esc(runId)}"${h}>` : "";
  return `<form method="post" action="${ADMIN_METRC_API_PATH}/${action}"${h}><input type="hidden" name="cursor" value="${esc(cursorId)}"${h}>${run}<button type="submit" ${hook}="${esc(cursorId)}"${h}>${esc(
    t(locale, label)
  )}</button></form>`;
}

/** The status cell's help (what a person does, ruling 2b) with the stored
 * sentence after it, so a short or ceiling row keeps its remedy. */
function statusTitle(locale: Locale, helpText: string, message: string | null): string {
  return ` title="${esc(t(locale, helpText))}${message ? ` ${esc(storedWords(locale, message))}` : ""}"`;
}

function endpointRow(row: MetrcEndpointLine, locale: Locale): string {
  const c = row.cursor;
  const r = row.run;
  const rowHelp = help(locale, HELP_ENDPOINTS);
  const status = r ? r.status : (c?.last_status ?? (row.note ? "skipped" : ""));
  const statusHelp = statusTitle(locale, HELP_STATUS, r?.message ?? row.note);
  const cursorHelp = help(locale, HELP_CURSOR);
  const heldHelp = help(locale, HELP_GONE_HELD);
  // The hold is the latest complete pass's (A29) and outlives the ticks after
  // it; the Confirm gone form names that pass. An armed override shows as
  // confirmed whether or not a pass is held right now.
  const armed = c?.gone_override === 1;
  const held =
    row.heldGone == null && !armed
      ? `<td data-metrc-gone-held="0"${rowHelp}>${esc(t(locale, "No"))}</td>`
      : `<td data-metrc-gone-held="${row.heldGone ?? 0}"${heldHelp}>${
          row.heldGone == null ? "" : `${esc(tFill(locale, "The next complete pass will mark {n} rows gone.", { n: String(row.heldGone) }))} `
        }${
          armed
            ? `<span data-metrc-gone-override="1"${help(locale, HELP_CONFIRM_GONE)}>${esc(t(locale, "Confirmed: the next complete pass marks gone without the guard."))}</span>`
            : c && row.heldGone != null
              ? cursorForm(locale, "confirm-gone", c.id, "data-metrc-confirm-gone", "Confirm gone", HELP_CONFIRM_GONE, row.heldRun)
              : ""
        }</td>`;
  const cells = [
    `<td${rowHelp}>${esc(row.license)}</td>`,
    `<td${rowHelp}>${esc(row.endpoint)}</td>`,
    `<td${rowHelp}>${r ? esc(stamp(r.started_at)) : esc(t(locale, "no run yet"))}</td>`,
    `<td${rowHelp}>${r ? esc(t(locale, own(METRC_RUN_KIND_WORDS, r.run_kind) ?? r.run_kind)) : ""}</td>`,
    `<td${rowHelp}>${r && r.rows != null ? r.rows : ""}</td>`,
    `<td${rowHelp}>${r && r.calls != null ? r.calls : ""}</td>`,
    `<td${rowHelp}>${r && r.failures != null ? r.failures : c ? c.failures : ""}</td>`,
    `<td data-metrc-status="${esc(status)}"${statusHelp}>${esc(statusWord(locale, status))}</td>`,
    `<td data-metrc-hwm="${esc(c?.hwm_end ?? "")}"${cursorHelp}>${c ? (c.hwm_end ? esc(c.hwm_end) : esc(t(locale, "no mark yet"))) : esc(t(locale, "no cursor yet"))}</td>`,
    `<td${cursorHelp}>${c ? esc(fullPassWords(locale, c)) : ""}</td>`,
    held,
    `<td${rowHelp}>${c ? cursorForm(locale, "reset-cursor", c.id, "data-metrc-reset-cursor", "Reset cursor", HELP_RESET_CURSOR) : ""}</td>`,
  ];
  const cursorAttrs = c ? ` data-metrc-cursor="${esc(c.id)}" data-metrc-cursor-mode="${esc(c.mode)}"` : "";
  return `<tr data-metrc-endpoint="${esc(row.endpoint)}" data-metrc-endpoint-license="${esc(row.license)}" data-metrc-endpoint-status="${esc(status)}"${cursorAttrs}${rowHelp}>${cells.join("")}</tr>`;
}

function labRow(data: MetrcAdmin, locale: Locale): string {
  const sweep = data.sweep;
  if (!sweep) return "";
  const rowHelp = help(locale, HELP_LAB_SWEEP);
  const failures = sweep.status === "failed" ? 1 : 0;
  const cells = [
    `<td${rowHelp}></td>`,
    `<td${rowHelp}>${esc(t(locale, "lab sweep"))}</td>`,
    `<td${rowHelp}>${esc(stamp(sweep.started_at))}</td>`,
    `<td${rowHelp}>${esc(t(locale, "lab sweep"))}</td>`,
    `<td${rowHelp}>${esc(sweep.packages_seen ?? "")}</td>`,
    `<td${rowHelp}></td>`,
    `<td${rowHelp}>${failures}</td>`,
    `<td data-metrc-status="${esc(sweep.status)}"${statusTitle(locale, HELP_LAB_SWEEP, sweep.message)}>${esc(statusWord(locale, sweep.status))}</td>`,
    `<td${rowHelp}></td>`,
    `<td${rowHelp}></td>`,
    `<td${rowHelp}></td>`,
    `<td${rowHelp}></td>`,
  ];
  return `<tr data-metrc-endpoint="lab" data-metrc-endpoint-license="" data-metrc-endpoint-status="${esc(sweep.status)}"${rowHelp}>${cells.join("")}</tr>`;
}

function endpointsSection(data: MetrcAdmin, locale: Locale): string {
  const h = help(locale, HELP_ENDPOINTS);
  const rows = data.endpoints ?? [];
  const heads = ["License", "Endpoint", "Last run", "Run kind", "Rows read", "Calls", "Failures", "Status", "High-water mark", "Full pass", "Gone held", "Actions"]
    .map((head) => `<th${h}>${esc(t(locale, head))}</th>`)
    .join("");
  const body = rows.map((row) => endpointRow(row, locale)).join("") + labRow(data, locale);
  const table = body
    ? `<div${h} class="report-scroll"><table${h}><thead${h}><tr${h}>${heads}</tr></thead><tbody${h}>${body}</tbody></table></div>`
    : `<p class="muted" data-metrc-endpoints-none${h}>${esc(t(locale, "No endpoint runs yet."))}</p>`;
  return `<section data-metrc-endpoints="${rows.length}"${h}>
      <h2${h}>${esc(t(locale, "Per endpoint"))}</h2>
      ${table}
    </section>`;
}

function sweepNowSection(data: MetrcAdmin, locale: Locale): string {
  const h = help(locale, HELP_SWEEP_NOW);
  const licenseHelp = help(locale, HELP_SWEEP_NOW_LICENSE);
  const options = (values: readonly string[], valueHelp: string) => values.map((value) => `<option value="${esc(value)}"${valueHelp}>${esc(value)}</option>`).join("");
  return `<section data-metrc-sweep-now${h}>
      <h2${h}>${esc(t(locale, "Sweep now"))}</h2>
      <form method="post" action="${ADMIN_METRC_API_PATH}/sweep-now"${h}>
        <label${licenseHelp}>${esc(t(locale, "License"))} <select name="license"${licenseHelp}>${options(data.sweepLicenses ?? [], licenseHelp)}</select></label>
        <label${h}>${esc(t(locale, "Endpoint"))} <select name="endpoint"${h}>${options(data.sweepEndpoints ?? [], h)}</select></label>
        <button type="submit" data-metrc-sweep-now-button${h}>${esc(t(locale, "Sweep now"))}</button>
      </form>
    </section>`;
}

function ageWords(locale: Locale, hours: number): string {
  if (hours < 48) return tFill(locale, "{h} hours ago", { h: String(hours) });
  return tFill(locale, "{d} days ago", { d: String(Math.floor(hours / 24)) });
}

function parityLicense(line: MetrcParityLine, locale: Locale): string {
  const h = help(locale, HELP_PARITY);
  const sentence =
    line.verdict === "none"
      ? t(locale, "No production dry run yet for this license.")
      : line.verdict === "clean"
        ? t(locale, "Parity reads clean.")
        : tFill(locale, "Parity differs: {a} would add, {u} would update, {g} would be gone ({h} held), {s} samples.", {
            a: String(line.totals.add),
            u: String(line.totals.update),
            g: String(line.totals.gone),
            h: String(line.totals.held),
            s: String(line.totals.samples),
          });
  const runs = line.runs
    .map(
      (run) =>
        `<li data-metrc-parity-run="${esc(run.endpoint)}" data-metrc-parity-run-kind="${esc(run.run_kind)}"${h}>${esc(run.endpoint)} (${esc(
          t(locale, own(METRC_RUN_KIND_WORDS, run.run_kind) ?? run.run_kind)
        )}): ${esc(stamp(run.started_at))}: ${esc(
          tFill(locale, "{a} would add, {u} would update, {g} would be gone, held {h}", {
            a: String(run.would_add),
            u: String(run.would_update),
            g: String(run.would_gone),
            h: String(run.gone_held),
          })
        )}</li>`
    )
    .join("");
  const sampleHeads = ["Endpoint", "Tag", "Column", "Mirror value", "API value"].map((head) => `<th${h}>${esc(t(locale, head))}</th>`).join("");
  const samples = line.samples
    .map(
      (s) =>
        `<tr data-metrc-sample="${esc(s.tag)}" data-metrc-sample-column="${esc(s.column)}" data-metrc-sample-crew="${s.crewMove ? "1" : "0"}"${h}><td${h}>${esc(s.endpoint)}</td><td${h}>${esc(s.tag)}</td><td${h}>${esc(
          s.column
        )}${s.crewMove ? ` (${esc(t(locale, "crew move"))})` : ""}</td><td${h}>${esc(s.mirrorValue ?? "")}</td><td${h}>${esc(s.apiValue ?? "")}</td></tr>`
    )
    .join("");
  const mountHelp = help(locale, HELP_MOUNT_AGE);
  const mounts =
    line.mounts.length > 0
      ? `<p data-metrc-csv-mounts="${line.mounts.length}"${mountHelp}>${esc(t(locale, "Latest CSV mount"))}: ${line.mounts
          .map((m) => `${esc(t(locale, m.kind))}${m.phase ? ` ${esc(t(locale, m.phase))}` : ""} ${esc(ageWords(locale, m.ageHours))}`)
          .join("; ")}</p>`
      : `<p class="muted" data-metrc-csv-mounts="0"${mountHelp}>${esc(t(locale, "No CSV mount yet."))}</p>`;
  return `<section data-metrc-parity-license="${esc(line.license)}" data-metrc-parity-verdict="${line.verdict}"${h}>
        <h3${h}>${esc(line.license)}</h3>
        <p data-metrc-parity-sentence="${line.verdict}"${h}>${esc(sentence)}</p>
        ${runs ? `<ul${h}>${runs}</ul>` : ""}
        ${samples ? `<table${h}><thead${h}><tr${h}>${sampleHeads}</tr></thead><tbody${h}>${samples}</tbody></table>` : ""}
        ${mounts}
      </section>`;
}

function paritySection(data: MetrcAdmin, locale: Locale): string {
  const h = help(locale, HELP_PARITY);
  const lines = data.parity ?? [];
  const overall = lines.some((line) => line.verdict === "differs") ? "differs" : lines.some((line) => line.verdict === "clean") ? "clean" : "none";
  const body = lines.length > 0 ? lines.map((line) => parityLicense(line, locale)).join("") : `<p class="muted" data-metrc-parity-none${h}>${esc(t(locale, "No production dry run yet."))}</p>`;
  return `<section data-metrc-parity="${overall}"${h}>
      <h2${h}>${esc(t(locale, "Parity"))}</h2>
      ${body}
    </section>`;
}

function labSweepLine(data: MetrcAdmin, locale: Locale): string {
  const h = help(locale, HELP_LAB_SWEEP);
  return data.sweep
    ? `<p data-metrc-sweep="${esc(data.sweep.status)}"${h}>${esc(t(locale, "Last lab sweep"))}: ${esc(easternStamp(data.sweep.started_at))} ${esc(statusWord(locale, data.sweep.status))}${
        data.sweep.message ? ` ${esc(storedWords(locale, data.sweep.message))}` : ""
      }</p>`
    : `<p class="muted" data-metrc-sweep=""${h}>${esc(t(locale, "No sweeps yet."))}</p>`;
}

/** MA1 Law 9: the page, in the spec's order: host and mode, keys, calls this
 * month, per endpoint, Sweep now, parity, the lab sweep, the write switch.
 * Every element carries a native title; every word reads through t(). */
export function metrcApiPage(data: MetrcAdmin, locale: Locale, ok: string | null, count: number): string {
  // The count comes from the query string: anything but a whole number reads 0.
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const absentFlash = [data.integrator ? "" : t(locale, "The integrator key is absent."), data.user ? "" : t(locale, "The user key is absent.")].filter(Boolean).join(" ");
  const licenses = data.licenses ?? [];
  const reachedCount = licenses.filter((row) => row.reach === "reached").length;
  const flashHelp = help(locale, HELP_FLASH);
  const extra = ok ? own(METRC_FLASH_WORDS, ok) : undefined;
  const flash =
    ok === "absent"
      ? `<p class="banner err" data-metrc-flash="absent"${flashHelp}>${esc(absentFlash)}</p>`
      : ok === "connected"
        ? `<p class="banner ok" data-metrc-flash="connected"${flashHelp}>${esc(
            tFill(locale, "Connected. {n} facilities. {r} of {k} licenses reached.", { n: String(n), r: String(reachedCount), k: String(licenses.length) })
          )}</p>`
        : ok === "refused"
          ? `<p class="banner err" data-metrc-flash="refused"${flashHelp}>${esc(t(locale, "Metrc refused the keys."))}</p>`
          : ok === "failed"
            ? `<p class="banner err" data-metrc-flash="failed"${flashHelp}>${esc(t(locale, "Metrc did not answer."))}</p>`
            : ok === "host"
              ? `<p class="banner err" data-metrc-flash="host"${flashHelp}>${esc(t(locale, METRC_HOST_REFUSAL))}</p>`
              : extra
                ? `<p class="banner ${extra.cls}" data-metrc-flash="${esc(ok ?? "")}"${flashHelp}>${esc(tFill(locale, extra.key, { n: String(n) }))}</p>`
                : "";
  return `<h1${help(locale, HELP_PAGE)}>${esc(t(locale, "Metrc API"))}</h1>
    ${flash}
    ${modeSection(data, locale)}
    ${keysSection(data, locale)}
    ${callsSection(data, locale)}
    ${endpointsSection(data, locale)}
    ${sweepNowSection(data, locale)}
    ${paritySection(data, locale)}
    ${labSweepLine(data, locale)}
    <p data-metrc-write="${METRC_WRITE_ENABLED ? "on" : "off"}"${help(locale, HELP_WRITE)}>${esc(t(locale, "The write switch is off."))}</p>`;
}
