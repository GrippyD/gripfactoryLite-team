/**
 * THE TESTING DESK (canon 0.30.164), part 3. The Metrc mirror is read-only.
 * Basic auth uses two wrangler secrets, METRC_INTEGRATOR_KEY and
 * METRC_USER_KEY. They are never vars and never written into a file, a log,
 * or this page. The base URL is the var METRC_API_BASE, sandbox unless the
 * owner points env.grip at production. The write switch below stays off:
 * POST /packages/v2/testing is shaped and not sent.
 */

import { nowIso } from "./audit";
import { ADMIN_METRC_API_PATH, SYSTEM_REASON } from "./config";
import { insertLog } from "./db";
import { releaseTestedFromMirror } from "./metrc";
import { t, type Locale } from "./i18n";
import { easternStamp } from "./sheetsync";
import { esc } from "./ui";

declare global {
  interface Env {
    METRC_INTEGRATOR_KEY?: string;
    METRC_USER_KEY?: string;
    METRC_API_BASE?: string;
  }
}

export const METRC_SANDBOX_BASE = "https://sandbox-api-mi.metrc.com";
export const METRC_PAGE_SIZE = 20;
export const METRC_MAX_PAGES = 20;
/** One hour plus five minutes, the docs' polling window. */
export const METRC_WINDOW_MS = 65 * 60 * 1000;
/** The switch is off. Nothing in this slice POSTs to Metrc. */
export const METRC_WRITE_ENABLED = false;
const RETRY_CAP_MS = 10_000;

export type MetrcEnv = {
  DB: D1Database;
  METRC_INTEGRATOR_KEY?: string;
  METRC_USER_KEY?: string;
  METRC_API_BASE?: string;
};

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
  env: Pick<MetrcEnv, "METRC_INTEGRATOR_KEY" | "METRC_USER_KEY" | "METRC_API_BASE">;
  path: string;
  query?: Record<string, string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
  clock?: () => number;
  record?: (row: CallRow) => Promise<void>;
};

export function keysPresent(env: Pick<MetrcEnv, "METRC_INTEGRATOR_KEY" | "METRC_USER_KEY">): { integrator: boolean; user: boolean } {
  return {
    integrator: (env.METRC_INTEGRATOR_KEY ?? "").trim() !== "",
    user: (env.METRC_USER_KEY ?? "").trim() !== "",
  };
}

/** https origin, or the sandbox when the var is blank or not https. */
export function metrcBase(env: Pick<MetrcEnv, "METRC_API_BASE">): string {
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

export function metrcHost(env: Pick<MetrcEnv, "METRC_API_BASE">): string {
  return new URL(metrcBase(env)).host;
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

export function callPath(url: string): string {
  const u = new URL(url);
  return (u.pathname + u.search).slice(0, 500);
}

/** Seconds, capped. An HTTP-date or a blank header waits one second. */
export function retryAfterMs(header: string | null): number {
  const n = Number(String(header ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return 1000;
  return Math.min(RETRY_CAP_MS, Math.round(n * 1000));
}

export function scrubKeys(text: string, keys: Array<string | undefined>): string {
  let out = text;
  for (const key of keys) {
    const k = (key ?? "").trim();
    if (k.length < 4) continue;
    out = out.split(k).join("[key]");
  }
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

function authHeader(integrator: string, user: string): string {
  return `Basic ${btoa(`${integrator}:${user}`)}`;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One GET. A 429 is counted, then retried once after Retry-After. */
export async function metrcGet(opts: GetOpts): Promise<{ status: number; body: unknown }> {
  const integrator = (opts.env.METRC_INTEGRATOR_KEY ?? "").trim();
  const user = (opts.env.METRC_USER_KEY ?? "").trim();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? nowIso;
  const clock = opts.clock ?? Date.now;
  const record = opts.record ?? (async () => undefined);
  const url = new URL(opts.path, metrcBase(opts.env));
  for (const [key, value] of Object.entries(opts.query ?? {})) url.searchParams.set(key, value);
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
        headers: { Accept: "application/json", Authorization: authHeader(integrator, user) },
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
      throw new Error(scrubKeys(err instanceof Error ? err.message : String(err), [integrator, user]));
    } finally {
      await record({ started_at: started, path, status, ms: Math.max(0, clock() - t0) });
    }
  };
  const first = await once();
  if (first.status !== 429) return { status: first.status, body: first.body };
  await sleep(retryAfterMs(first.retry));
  const second = await once();
  return { status: second.status, body: second.body };
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

async function recordCall(db: D1Database, row: CallRow): Promise<void> {
  await db
    .prepare(`INSERT INTO metrc_api_calls (id, started_at, path, status, ms) VALUES (?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), row.started_at, row.path, row.status, row.ms)
    .run();
}

function absentWords(keys: { integrator: boolean; user: boolean }): string {
  const parts: string[] = [];
  if (!keys.integrator) parts.push("The integrator key is absent.");
  if (!keys.user) parts.push("The user key is absent.");
  return parts.join(" ");
}

async function readPaged(opts: GetOpts & { query: Record<string, string> }): Promise<{ rows: unknown[]; refused: boolean }> {
  const rows: unknown[] = [];
  let page = 1;
  for (let i = 0; i < METRC_MAX_PAGES; i++) {
    const res = await metrcGet({ ...opts, query: { ...opts.query, pageNumber: String(page), pageSize: String(METRC_PAGE_SIZE) } });
    if (res.status === 401 || res.status === 403) return { rows, refused: true };
    if (res.status >= 400 || res.status === 0) throw new Error(`Metrc answered ${res.status}.`);
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
    const licenses = await env.DB
      .prepare(`SELECT value FROM lookup_values WHERE category = 'license' AND deleted_at IS NULL ORDER BY value`)
      .all<{ value: string }>();
    const facilities = (licenses.results ?? []).map((row) => row.value).filter(facilityLicense);
    const window = modifiedWindow(Date.now());
    const getOpts = {
      env,
      fetchImpl: fetch,
      record: (row: CallRow) => recordCall(env.DB, row),
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
    await applyChanges(env.DB, changes, finished);
    const wrotePackageState = changes.some((change) => (change.table as string) === "metrc_packages" && change.field === "lab_test_status");
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
      message: [baseMessage, releaseNote].filter(Boolean).join(" ") || null,
      packages_seen: byLabel.size,
      results_read: resultsRead,
      fields_written: changes.length,
    });
  } catch (err) {
    const message = scrubKeys(err instanceof Error ? err.message : String(err), [env.METRC_INTEGRATOR_KEY, env.METRC_USER_KEY]);
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

export type ConnectionResult = { code: "absent" | "connected" | "refused" | "failed"; n: number };

export async function testMetrcConnection(env: MetrcEnv): Promise<ConnectionResult> {
  const keys = keysPresent(env);
  if (!keys.integrator || !keys.user) return { code: "absent", n: 0 };
  try {
    const res = await metrcGet({
      env,
      path: "/facilities/v2",
      record: (row) => recordCall(env.DB, row),
    });
    if (res.status === 401 || res.status === 403) return { code: "refused", n: 0 };
    if (res.status >= 400 || res.status === 0) return { code: "failed", n: 0 };
    return { code: "connected", n: facilityCount(res.body) };
  } catch {
    return { code: "failed", n: 0 };
  }
}

export type MetrcAdmin = {
  integrator: boolean;
  user: boolean;
  host: string;
  calls: number;
  sweep: SweepRow | null;
};

export async function loadMetrcAdmin(env: MetrcEnv): Promise<MetrcAdmin> {
  const keys = keysPresent(env);
  const month = nowIso().slice(0, 7);
  const [calls, sweep] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM metrc_api_calls WHERE started_at >= ?`).bind(`${month}-01`).first<{ n: number }>(),
    env.DB.prepare(
      `SELECT id, started_at, finished_at, status, trigger, message, packages_seen, results_read, fields_written
       FROM metrc_sweeps ORDER BY started_at DESC LIMIT 1`
    ).first<SweepRow>(),
  ]);
  return { integrator: keys.integrator, user: keys.user, host: metrcHost(env), calls: Number(calls?.n ?? 0), sweep: sweep ?? null };
}

export function metrcApiPage(data: MetrcAdmin, locale: Locale, ok: string | null, n: number): string {
  const keyLine = (name: string, present: boolean) =>
    `<p data-metrc-${name}="${present ? "present" : "absent"}">${esc(t(locale, name === "integrator" ? "Integrator key" : "User key"))}: ${esc(
      t(locale, present ? "present" : "absent")
    )}</p>`;
  const absentFlash = [data.integrator ? "" : t(locale, "The integrator key is absent."), data.user ? "" : t(locale, "The user key is absent.")].filter(Boolean).join(" ");
  const flash =
    ok === "absent"
      ? `<p class="banner err" data-metrc-flash="absent">${esc(absentFlash)}</p>`
      : ok === "connected"
        ? `<p class="banner ok" data-metrc-flash="connected">${esc(t(locale, "Connected. {n} facilities.").replace("{n}", String(n)))}</p>`
        : ok === "refused"
          ? `<p class="banner err" data-metrc-flash="refused">${esc(t(locale, "Metrc refused the keys."))}</p>`
          : ok === "failed"
            ? `<p class="banner err" data-metrc-flash="failed">${esc(t(locale, "Metrc did not answer."))}</p>`
            : "";
  const sweep = data.sweep
    ? `<p data-metrc-sweep="${esc(data.sweep.status)}">${esc(t(locale, "Last sweep"))}: ${esc(easternStamp(data.sweep.started_at))} ${esc(data.sweep.status)}${
        data.sweep.message ? ` ${esc(data.sweep.message)}` : ""
      }</p>`
    : `<p class="muted" data-metrc-sweep="">${esc(t(locale, "No sweeps yet."))}</p>`;
  return `<h1>${esc(t(locale, "Metrc API"))}</h1>
    ${flash}
    ${keyLine("integrator", data.integrator)}
    ${keyLine("user", data.user)}
    <p data-metrc-base="${esc(data.host)}">${esc(t(locale, "Base"))}: ${esc(data.host)}</p>
    <p data-metrc-calls="${esc(String(data.calls))}">${esc(t(locale, "Calls this month"))}: ${esc(String(data.calls))}</p>
    ${sweep}
    <p data-metrc-write="${METRC_WRITE_ENABLED ? "on" : "off"}">${esc(t(locale, "The write switch is off."))}</p>
    <form method="post" action="${ADMIN_METRC_API_PATH}/test">
      <button type="submit" data-metrc-test>${esc(t(locale, "Test connection"))}</button>
    </form>`;
}
