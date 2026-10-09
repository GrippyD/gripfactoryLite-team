/**
 * MA1 Phase B, Law 5 (THE CADENCE AND CURSOR LAW): the pager, the cursor and
 * the budget engine the METRC mirror sweep runs on. Reads only. Phase C's
 * consumers pass onPage; nothing here touches the mirror tables.
 *
 * - Every call sends pageNumber and pageSize (A3); the page size is clamped
 *   to 1..50, the docs' maximum (GET_packages_v2_active.txt:20).
 * - A series stops on Page >= TotalPages (authoritative when present, Phase C
 *   ruling C2), on a page of 0 rows, on a short page only when the envelope
 *   lacks TotalPages, or at a hard page ceiling, which records an incomplete
 *   result and is never a silent stop. A full pass that meets 0 rows while
 *   TotalPages still names more pages is incomplete too ("short"); an
 *   incremental window that meets one keeps its mark and re-reads that page
 *   next tick (the run says "short"), so no page past it is skipped.
 * - lastModified windows are ISO UTC without milliseconds, walked oldest first
 *   (page_best-practices.txt:37), one at a time. The high-water mark moves only
 *   when every page of a window is read; a tick that runs out mid-window keeps
 *   the mark and resumes at win_page with the same window. A window that
 *   reaches the page ceiling is halved and read again, down to a floor.
 * - Cursors are keyed by host, license, endpoint and mode (A26: a dry_run
 *   cursor never moves a write cursor) and saved after every page. An
 *   incremental saves only its own columns and a full pass only its own, so
 *   two runs on one scope never write back each other's old copy.
 * - A write scope runs only on a production host (Law 3): sandbox data never
 *   enters the live mirror, whatever mode a caller passes.
 * - A full pass keeps its seen tags one row per page in metrc_pass_pages
 *   across ticks and deletes them when it completes or is dropped (A13). Its
 *   next pass is due by cadence from the pass's start.
 * - A second 429, or a Retry-After above the cap, ends that scope for the
 *   tick with its cursor saved. Nothing here throws past a scope (a D1 error
 *   becomes a failed scope), so other licenses carry on. The lab sweep
 *   (metrcapi.ts readPaged) is not this pager.
 * - The budget counts calls (per tick and per license), rows, wall time and
 *   D1 queries (a code constant, A27); the month's calls pace the tick (A17).
 */

import { nowIso } from "./audit";
import { METRC_MAX_PAGE_SIZE, METRC_SWEEP_CONFIG_KEYS, metrcSweepConfigOf, type MetrcSweepConfig } from "./config";
import {
  METRC_HOST_REFUSAL,
  MetrcHostRefused,
  absentWords,
  basicToken,
  keysPresent,
  metrcGet,
  metrcHost,
  metrcHostKind,
  recordMetrcCall,
  scrubKeys,
  userKeyFor,
  type CallRow,
  type MetrcEnv,
} from "./metrcapi";

export { METRC_MAX_PAGE_SIZE };

/** Pages per window or per full pass before the series is recorded incomplete. */
export const METRC_PAGE_CEILING = 4000;
/** D1 queries one mirror tick may spend: 700 of an invocation's 1,000 (A27). */
export const METRC_TICK_D1 = 700;
/** A full pass is due this much before its cadence ends, so the same tick a
 * cadence later always finds it due (ticks start a few seconds apart). */
export const METRC_DUE_TOLERANCE_MS = 5 * 60_000;

export const NEEDS_FULL_WORDS = "This scope needs a complete full pass before any incremental read.";
export const CEILING_WINDOW_WORDS = "The page ceiling was reached inside a window that cannot be halved further, so the high-water mark did not move.";
export const CEILING_PASS_WORDS = "The page ceiling was reached inside a full pass, so the pass is incomplete, marks nothing gone, and starts again at its cadence.";
export const SHORT_PASS_WORDS = "A page came back short while TotalPages named more pages, so the pass is incomplete, marks nothing gone, and starts again at its cadence.";
export const SHORT_WINDOW_WORDS = "A page came back with 0 rows while TotalPages named more pages, so the window is not read whole: the high-water mark stays and that page is read again next tick.";
export const HOST_MISMATCH_WORDS = "The scope's host is not the METRC host.";
export const WRITE_SCOPE_WORDS = "Write mode is refused on a host that is not a production host: sandbox data never enters the live mirror.";
export const REFUSED_WORDS = "Metrc refused this license.";
export const SECOND_429_WORDS = "Metrc answered 429 twice, so this scope stops for the tick.";
export const ABOVE_CAP_WORDS = "Metrc asked for a wait above the cap, so this scope stops for the tick.";

export type CursorMode = "dry_run" | "write";
export type MetrcKind = "plants" | "packages" | "harvests";

/** One sweep scope: a license's endpoint on one host in one mode. */
export type MetrcScope = {
  host: string;
  license: string;
  endpoint: string;
  mode: CursorMode;
  kind: MetrcKind;
  phase: string | null;
};

export type MetrcCursor = {
  id: string;
  host: string;
  license_value: string;
  endpoint: string;
  mode: string;
  kind: string;
  phase: string | null;
  hwm_end: string | null;
  win_start: string | null;
  win_end: string | null;
  win_page: number;
  full_pass_id: string | null;
  full_started_at: string | null;
  full_page: number;
  full_total_pages: number | null;
  full_total_records: number | null;
  full_rows_seen: number;
  full_completed_at: string | null;
  full_due_at: string | null;
  gone_override: number;
  last_status: string | null;
  last_http: number | null;
  last_run_at: string | null;
  failures: number;
};

// ---------------------------------------------------------------- envelope

export type Envelope = { rows: unknown[]; page: number; totalPages: number | null; totalRecords: number | null; bare: boolean };

function wholeOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** An object with a Data array is one page (Page, TotalPages, TotalRecords;
 * GET_packages_v2_active.txt:363-369). A bare array is one complete page.
 * Anything else is not a page (null). The page is never taken as earlier
 * than the page asked for, so a server that echoes Page 1 on every page
 * still stops at TotalPages. */
export function parseEnvelope(body: unknown, requestedPage = 1): Envelope | null {
  if (Array.isArray(body)) return { rows: body, page: 1, totalPages: 1, totalRecords: body.length, bare: true };
  if (!body || typeof body !== "object") return null;
  const obj = body as { Data?: unknown; Page?: unknown; TotalPages?: unknown; TotalRecords?: unknown };
  if (!Array.isArray(obj.Data)) return null;
  const page = wholeOrNull(obj.Page);
  return {
    rows: obj.Data,
    page: page != null && page >= 1 ? Math.max(page, requestedPage) : requestedPage,
    totalPages: wholeOrNull(obj.TotalPages),
    totalRecords: wholeOrNull(obj.TotalRecords),
    bare: false,
  };
}

/** MA1 Phase C ruling C2: when the envelope carries TotalPages it is
 * authoritative, so the series ends on Page >= TotalPages or on a page with 0
 * rows, never on a short page (a server that pages smaller than asked still
 * reads to its last page). The short-page stop applies only to a bare array
 * (one complete page) or an envelope that lacks TotalPages. */
export function seriesDone(envelope: Envelope, pageSize: number): boolean {
  if (envelope.bare) return true;
  if (envelope.totalPages != null) return envelope.page >= envelope.totalPages || envelope.rows.length === 0;
  return envelope.rows.length < pageSize;
}

/** A page of 0 rows while TotalPages still names later pages: the series
 * stops but did not read every page, so a full pass is never complete. */
export function shortBeforeLastPage(envelope: Envelope, _pageSize: number): boolean {
  if (envelope.bare || envelope.totalPages == null) return false;
  return envelope.rows.length === 0 && envelope.page < envelope.totalPages;
}

export function clampPageSize(n: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return METRC_MAX_PAGE_SIZE;
  return Math.min(METRC_MAX_PAGE_SIZE, Math.max(1, v));
}

// ---------------------------------------------------------------- one page

export type PageResult =
  | ({ kind: "ok"; status: number } & Envelope)
  | { kind: "refused"; status: number; message: string }
  | { kind: "rate_limited"; status: number; reason: "second_429" | "retry_after_above_cap"; message: string }
  | { kind: "failed"; status: number; message: string }
  | { kind: "host_refused"; status: 0; message: string };

export type PageRead = {
  env: Pick<MetrcEnv, "METRC_INTEGRATOR_KEY" | "METRC_USER_KEY" | "METRC_API_BASE">;
  path: string;
  query: Record<string, string>;
  page: number;
  pageSize: number;
  userKey?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
  clock?: () => number;
  record?: (row: CallRow) => Promise<void>;
};

/** One page, tagged. Each HTTP attempt is recorded through metrcGet's record.
 * A 3xx is a failed page (redirects are not followed), never an empty one. */
export async function readMetrcPage(opts: PageRead): Promise<PageResult> {
  const pageSize = clampPageSize(opts.pageSize);
  const query = { ...opts.query, pageNumber: String(opts.page), pageSize: String(pageSize) };
  try {
    const res = await metrcGet({
      env: opts.env,
      path: opts.path,
      query,
      userKey: opts.userKey,
      stopAboveCap: true,
      fetchImpl: opts.fetchImpl,
      sleep: opts.sleep,
      now: opts.now,
      clock: opts.clock,
      record: opts.record,
    });
    if (res.status === 401 || res.status === 403) return { kind: "refused", status: res.status, message: REFUSED_WORDS };
    if (res.status === 429) {
      const second = res.attempts >= 2;
      return {
        kind: "rate_limited",
        status: 429,
        reason: second ? "second_429" : "retry_after_above_cap",
        message: second ? SECOND_429_WORDS : ABOVE_CAP_WORDS,
      };
    }
    if (res.status === 0 || res.status >= 300) return { kind: "failed", status: res.status, message: `Metrc answered ${res.status}.` };
    const envelope = parseEnvelope(res.body, opts.page);
    if (!envelope) return { kind: "failed", status: res.status, message: "Metrc answered without a page." };
    return { kind: "ok", status: res.status, ...envelope };
  } catch (err) {
    if (err instanceof MetrcHostRefused) return { kind: "host_refused", status: 0, message: METRC_HOST_REFUSAL };
    const integrator = (opts.env.METRC_INTEGRATOR_KEY ?? "").trim();
    const user = (opts.userKey != null ? opts.userKey : opts.env.METRC_USER_KEY ?? "").trim();
    const text = err instanceof Error ? err.message : String(err);
    return { kind: "failed", status: 0, message: scrubKeys(text, [integrator, user, basicToken(integrator, user)]) || "Metrc did not answer." };
  }
}

// ---------------------------------------------------------------- windows

/** ISO UTC to the second, without milliseconds: YYYY-MM-DDTHH:MM:SSZ. */
export function isoSeconds(ms: number): string {
  return `${new Date(Math.floor(ms / 1000) * 1000).toISOString().slice(0, 19)}Z`;
}

/** The next lastModified window after the high-water mark, or null when the
 * mark has reached now. Start is the mark minus the overlap; end is the
 * earlier of now and start plus the longest window (never shorter than the
 * overlap plus a minute, so a window always moves the mark forward). */
export function nextWindow(input: { hwmEnd: string; nowIso: string; overlapMinutes: number; maxMinutes: number }): { start: string; end: string } | null {
  const hwm = Date.parse(input.hwmEnd);
  const now = Math.floor(Date.parse(input.nowIso) / 1000) * 1000;
  if (!Number.isFinite(hwm) || !Number.isFinite(now) || hwm >= now) return null;
  const overlap = Math.max(0, input.overlapMinutes) * 60_000;
  const span = Math.max(input.maxMinutes * 60_000, overlap + 60_000);
  const start = hwm - overlap;
  return { start: isoSeconds(start), end: isoSeconds(Math.min(now, start + span)) };
}

/** A window that reached the page ceiling ends at its midpoint instead, or
 * null at the floor: the halved end must still lie after the high-water
 * mark, or the finished window would not move the mark. */
export function halveWindow(start: string, end: string, hwmEnd: string | null): string | null {
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  const mid = Math.floor((s + (e - s) / 2) / 1000) * 1000;
  const hwm = Date.parse(hwmEnd ?? "");
  const floor = Number.isFinite(hwm) ? hwm : s;
  if (mid <= floor || mid >= e) return null;
  return isoSeconds(mid);
}

// ---------------------------------------------------------------- budget

export type BudgetLimits = { calls: number; licenseCalls: number; rows: number; wallMs: number; d1: number };
export type BudgetStop = "calls" | "license_calls" | "rows" | "wall" | "d1";

type BudgetState = {
  limits: BudgetLimits;
  clock: () => number;
  started: number;
  calls: number;
  rows: number;
  d1: number;
  perLicense: Map<string, number>;
};

/** One tick's budget. forLicense gives a view that also holds the license's
 * own call cap; every view spends from the same tick. */
export class MetrcBudget {
  private readonly state: BudgetState;
  private readonly license: string | null;

  private constructor(state: BudgetState, license: string | null) {
    this.state = state;
    this.license = license;
  }

  static start(limits: BudgetLimits, clock: () => number = Date.now): MetrcBudget {
    return new MetrcBudget({ limits, clock, started: clock(), calls: 0, rows: 0, d1: 0, perLicense: new Map() }, null);
  }

  forLicense(license: string): MetrcBudget {
    return new MetrcBudget(this.state, license);
  }

  get limits(): BudgetLimits {
    return this.state.limits;
  }

  get calls(): number {
    return this.state.calls;
  }

  get licenseCalls(): number {
    return this.license == null ? 0 : this.state.perLicense.get(this.license) ?? 0;
  }

  get rows(): number {
    return this.state.rows;
  }

  get d1(): number {
    return this.state.d1;
  }

  get wallMs(): number {
    return Math.max(0, this.state.clock() - this.state.started);
  }

  spendCall(): void {
    this.state.calls += 1;
    if (this.license != null) this.state.perLicense.set(this.license, (this.state.perLicense.get(this.license) ?? 0) + 1);
  }

  spendRows(n: number): void {
    this.state.rows += Math.max(0, n);
  }

  spendD1(n: number): void {
    this.state.d1 += Math.max(0, n);
  }

  stop(): BudgetStop | null {
    const s = this.state;
    if (s.calls >= s.limits.calls) return "calls";
    if (this.license != null && this.licenseCalls >= s.limits.licenseCalls) return "license_calls";
    if (s.rows >= s.limits.rows) return "rows";
    if (s.d1 >= s.limits.d1) return "d1";
    if (this.wallMs >= s.limits.wallMs) return "wall";
    return null;
  }

  exhausted(): boolean {
    return this.stop() !== null;
  }
}

/** The UTC hourly ticks left in this month, this one included (at least 1). */
export function ticksLeftInMonth(nowIsoValue: string, tickMinutes = 60): number {
  const now = Date.parse(nowIsoValue);
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((next - now) / (Math.max(1, tickMinutes) * 60_000)));
}

/** MA1 A17, the month pace (a pace, never a stop): the smaller of the tick's
 * calls and what is left of the month's calls over the ticks left, never
 * below one call per incremental scope. */
export function pacedTickCalls(input: { tickCalls: number; monthCalls: number; usedThisMonth: number; ticksLeft: number; scopes: number }): number {
  const left = Math.max(0, input.monthCalls - input.usedThisMonth);
  const pace = Math.floor(left / Math.max(1, input.ticksLeft));
  return Math.max(Math.max(0, input.scopes), Math.min(input.tickCalls, pace));
}

/** Calls this UTC month on one host (MA1 A18, the month pace per host): rows
 * of the host given, plus rows written before 0098 added the column (host
 * null, the conservative reading). Without a host, every host's calls. */
export async function callsThisMonth(db: D1Database, nowIsoValue: string, host: string | null = null): Promise<number> {
  const month = `${nowIsoValue.slice(0, 7)}-01`;
  const row =
    host == null
      ? await db.prepare(`SELECT COUNT(*) AS n FROM metrc_api_calls WHERE started_at >= ?`).bind(month).first<{ n: number }>()
      : await db
          .prepare(`SELECT COUNT(*) AS n FROM metrc_api_calls WHERE started_at >= ? AND (host = ? OR host IS NULL)`)
          .bind(month, host)
          .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export function tickLimits(config: MetrcSweepConfig, calls: number): BudgetLimits {
  return { calls, licenseCalls: config.tickLicenseCalls, rows: config.tickRows, wallMs: config.tickWallMs, d1: METRC_TICK_D1 };
}

/** The tick's budget: the month pace (of one host when given, A18) over the
 * configured caps. */
export async function startTickBudget(
  db: D1Database,
  config: MetrcSweepConfig,
  at: string,
  scopes: number,
  clock: () => number = Date.now,
  host: string | null = null
): Promise<{ budget: MetrcBudget; calls: number; usedThisMonth: number }> {
  const usedThisMonth = await callsThisMonth(db, at, host);
  const calls = pacedTickCalls({ tickCalls: config.tickCalls, monthCalls: config.monthCalls, usedThisMonth, ticksLeft: ticksLeftInMonth(at), scopes });
  const budget = MetrcBudget.start(tickLimits(config, calls), clock);
  budget.spendD1(1);
  return { budget, calls, usedThisMonth };
}

/** Every Law 5 key in one query, parsed with the 0096 seeds as fallbacks. */
export async function loadMetrcSweepConfig(db: D1Database): Promise<MetrcSweepConfig> {
  const marks = METRC_SWEEP_CONFIG_KEYS.map(() => "?").join(", ");
  const rows = await db
    .prepare(`SELECT key, value FROM app_config WHERE deleted_at IS NULL AND key IN (${marks})`)
    .bind(...METRC_SWEEP_CONFIG_KEYS)
    .all<{ key: string; value: string }>();
  const byKey = new Map((rows.results ?? []).map((row) => [row.key, row.value]));
  return metrcSweepConfigOf((key) => byKey.get(key) ?? null);
}

// ---------------------------------------------------------------- cursors

const CURSOR_COLUMNS =
  "id, host, license_value, endpoint, mode, kind, phase, hwm_end, win_start, win_end, win_page, full_pass_id, full_started_at, full_page, " +
  "full_total_pages, full_total_records, full_rows_seen, full_completed_at, full_due_at, gone_override, last_status, last_http, last_run_at, failures";

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cursorOf(row: Record<string, unknown>): MetrcCursor {
  return {
    id: String(row.id),
    host: String(row.host),
    license_value: String(row.license_value),
    endpoint: String(row.endpoint),
    mode: String(row.mode),
    kind: String(row.kind),
    phase: textOrNull(row.phase),
    hwm_end: textOrNull(row.hwm_end),
    win_start: textOrNull(row.win_start),
    win_end: textOrNull(row.win_end),
    win_page: Number(row.win_page ?? 0),
    full_pass_id: textOrNull(row.full_pass_id),
    full_started_at: textOrNull(row.full_started_at),
    full_page: Number(row.full_page ?? 0),
    full_total_pages: numberOrNull(row.full_total_pages),
    full_total_records: numberOrNull(row.full_total_records),
    full_rows_seen: Number(row.full_rows_seen ?? 0),
    full_completed_at: textOrNull(row.full_completed_at),
    full_due_at: textOrNull(row.full_due_at),
    gone_override: Number(row.gone_override ?? 0),
    last_status: textOrNull(row.last_status),
    last_http: numberOrNull(row.last_http),
    last_run_at: textOrNull(row.last_run_at),
    failures: Number(row.failures ?? 0),
  };
}

export async function loadCursor(db: D1Database, scope: MetrcScope): Promise<MetrcCursor | null> {
  const row = await db
    .prepare(`SELECT ${CURSOR_COLUMNS} FROM metrc_cursors WHERE host = ? AND license_value = ? AND endpoint = ? AND mode = ? AND deleted_at IS NULL`)
    .bind(scope.host, scope.license, scope.endpoint, scope.mode)
    .first<Record<string, unknown>>();
  return row ? cursorOf(row) : null;
}

/** Load the scope's live cursor; create it on first use, or afresh after a
 * soft delete (the unique index covers live rows only). */
export async function ensureCursor(db: D1Database, scope: MetrcScope, at: string, budget?: MetrcBudget): Promise<MetrcCursor> {
  const found = await loadCursor(db, scope);
  budget?.spendD1(1);
  if (found) return found;
  await db
    .prepare(
      `INSERT INTO metrc_cursors (id, host, license_value, endpoint, mode, kind, phase, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)
       ON CONFLICT (host, license_value, endpoint, mode) WHERE deleted_at IS NULL DO NOTHING`
    )
    .bind(crypto.randomUUID(), scope.host, scope.license, scope.endpoint, scope.mode, scope.kind, scope.phase, at, at)
    .run();
  const made = await loadCursor(db, scope);
  budget?.spendD1(2);
  if (!made) throw new Error("The METRC cursor could not be read.");
  return made;
}

/** An incremental's save: the mark, the window and the run's status only.
 * It never writes the full pass's columns or gone_override, so an incremental
 * that loaded its copy before a full pass finished cannot bring the pass back. */
function saveIncrementalStmt(db: D1Database, c: MetrcCursor, at: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE metrc_cursors SET
         hwm_end = ?, win_start = ?, win_end = ?, win_page = ?,
         last_status = ?, last_http = ?, last_run_at = ?, failures = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(c.hwm_end, c.win_start, c.win_end, c.win_page, c.last_status, c.last_http, c.last_run_at, c.failures, at, c.id);
}

/** A full pass's save: the pass's columns and the run's status only. The mark
 * is set only where there is none (A26), never moved, and gone_override is
 * never written here. */
function saveFullStmt(db: D1Database, c: MetrcCursor, at: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE metrc_cursors SET
         full_pass_id = ?, full_started_at = ?, full_page = ?, full_total_pages = ?, full_total_records = ?, full_rows_seen = ?,
         full_completed_at = ?, full_due_at = ?, hwm_end = COALESCE(hwm_end, ?),
         last_status = ?, last_http = ?, last_run_at = ?, failures = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      c.full_pass_id,
      c.full_started_at,
      c.full_page,
      c.full_total_pages,
      c.full_total_records,
      c.full_rows_seen,
      c.full_completed_at,
      c.full_due_at,
      c.hwm_end,
      c.last_status,
      c.last_http,
      c.last_run_at,
      c.failures,
      at,
      c.id
    );
}

/** MA1 A26: a pass in progress, an empty cursor, or a pass due by cadence.
 * An empty cursor whose last pass was dropped (ceiling or short) waits for
 * the due time that drop set, so a pass that cannot finish is not restarted
 * on every tick. */
export function needsFullPass(cursor: Pick<MetrcCursor, "hwm_end" | "full_pass_id" | "full_due_at"> | null, nowIsoValue: string): boolean {
  if (!cursor) return true;
  if (cursor.full_pass_id) return true;
  if (!cursor.full_due_at) return true;
  return Date.parse(cursor.full_due_at) <= Date.parse(nowIsoValue);
}

export function fullCadenceHours(config: MetrcSweepConfig, kind: MetrcKind): number {
  if (kind === "plants") return config.fullPlantsHours;
  if (kind === "harvests") return config.fullHarvestsHours;
  return config.fullPackagesHours;
}

/** The next full pass of a completed one: its start plus the cadence, less
 * the tolerance. Counting from the start keeps a daily pass daily and a
 * weekly pass weekly however many ticks the pass took. */
export function fullDueAt(passStartedAt: string, cadenceHours: number): string {
  return isoSeconds(Date.parse(passStartedAt) + cadenceHours * 3_600_000 - METRC_DUE_TOLERANCE_MS);
}

// ---------------------------------------------------------------- runs

export type ScopeStatus =
  | "ok"
  | "budget"
  | "refused"
  | "rate_limited"
  | "failed"
  | "host_refused"
  | "mode_refused"
  | "ceiling"
  | "short"
  | "needs_full"
  | "absent";

export type PageContext = {
  scope: MetrcScope;
  run: "incremental" | "full";
  page: number;
  window: { start: string; end: string } | null;
  passId: string | null;
  passStartedAt: string | null;
  totalRecords: number | null;
  budget: MetrcBudget;
};

export type FullPassDone = {
  complete: true;
  seenTags: Set<string>;
  totalRecords: number;
  passId: string;
  passStartedAt: string;
  pages: number;
  rows: number;
  cursor: MetrcCursor;
};

export type FullPassStopped = { complete: false; status: ScopeStatus; pages: number; rows: number; message: string | null; cursor: MetrcCursor | null };
export type FullPassResult = FullPassDone | FullPassStopped;

export type IncrementalResult = { status: ScopeStatus; pages: number; rows: number; windows: number; message: string | null; cursor: MetrcCursor | null };

export type PagerDeps = {
  db: D1Database;
  env: Pick<MetrcEnv, "METRC_INTEGRATOR_KEY" | "METRC_USER_KEY" | "METRC_API_BASE">;
  /** The tick's budget; each run spends through its license's view. */
  budget: MetrcBudget;
  config: MetrcSweepConfig;
  now?: () => string;
  clock?: () => number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onPage: (rows: unknown[], ctx: PageContext) => Promise<void>;
  /** Runs before a complete pass clears its pages; a throw keeps the pass. */
  onComplete?: (pass: FullPassDone, ctx: PageContext) => Promise<void>;
  pageCeiling?: number;
};

function precheck(scope: MetrcScope, env: PagerDeps["env"]): { status: ScopeStatus; message: string } | null {
  const kind = metrcHostKind(env);
  if (kind === "other") return { status: "host_refused", message: METRC_HOST_REFUSAL };
  if (scope.host !== metrcHost(env)) return { status: "failed", message: HOST_MISMATCH_WORDS };
  // Law 3: write mode is refused unless the host is a production host.
  if (scope.mode === "write" && kind !== "production") return { status: "mode_refused", message: WRITE_SCOPE_WORDS };
  const keys = keysPresent(env);
  const user = userKeyFor(env, scope.license);
  if (!keys.integrator || !user) return { status: "absent", message: absentWords({ integrator: keys.integrator, user: user != null }) };
  return null;
}

function budgetWords(stop: BudgetStop | null): string {
  return `The tick's budget ran out (${stop ?? "calls"}), so the cursor was saved where it stands.`;
}

/** Every attempt spends a call and a D1 query and lands in metrc_api_calls
 * with the scope's host (0098, A18). */
export function recorder(db: D1Database, budget: MetrcBudget, host: string): (row: CallRow) => Promise<void> {
  return async (row) => {
    budget.spendCall();
    budget.spendD1(1);
    await recordMetrcCall(db, row, host);
  };
}

/** The cursor after a page that did not answer: the window or pass stays put. */
function afterStop(cursor: MetrcCursor, res: Exclude<PageResult, { kind: "ok" }>, at: string): { cursor: MetrcCursor; status: ScopeStatus } {
  if (res.kind === "rate_limited") return { cursor: { ...cursor, last_status: "retry_after", last_http: res.status, last_run_at: at }, status: "rate_limited" };
  if (res.kind === "refused") {
    return { cursor: { ...cursor, last_status: "refused", last_http: res.status, last_run_at: at, failures: cursor.failures + 1 }, status: "refused" };
  }
  if (res.kind === "host_refused") return { cursor: { ...cursor, last_status: "host_refused", last_http: null, last_run_at: at }, status: "host_refused" };
  return { cursor: { ...cursor, last_status: "failed", last_http: res.status, last_run_at: at, failures: cursor.failures + 1 }, status: "failed" };
}

/** The keys a page carries for the pass's seen set: the Label (plants and
 * packages), else the Id as text (harvests carry no label; MA1 A37). Keys are
 * upper-cased as the mirror keys its tags (shapePlantRow, shapePackageRow),
 * so a label Metrc sends in another case on an earlier tick's page still
 * counts as seen when the pass completes; a harvest id is digits, unchanged. */
function labelsOf(rows: unknown[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const label = (row as { Label?: unknown }).Label;
    const key = label != null ? label : (row as { Id?: unknown }).Id;
    if (key == null) continue;
    const text = String(key).trim().toUpperCase();
    if (text) out.push(text);
  }
  return out;
}

function scrubbed(err: unknown, env: PagerDeps["env"], user: string): string {
  const integrator = (env.METRC_INTEGRATOR_KEY ?? "").trim();
  const text = err instanceof Error ? err.message : String(err);
  return scrubKeys(text, [integrator, user, basicToken(integrator, user)]) || "The page reader failed.";
}

/** One scope's incremental read: lastModified windows from the high-water
 * mark, oldest first, until the mark reaches now or the budget runs out. An
 * empty cursor returns needs_full and makes no call (A26). A D1 error ends
 * the scope as failed, scrubbed, and never throws past it. */
export async function runIncremental(scope: MetrcScope, deps: PagerDeps): Promise<IncrementalResult> {
  const result: IncrementalResult = { status: "ok", pages: 0, rows: 0, windows: 0, message: null, cursor: null };
  try {
    return await incremental(scope, deps, result);
  } catch (err) {
    return { ...result, status: "failed", message: scrubbed(err, deps.env, userKeyFor(deps.env, scope.license) ?? "") };
  }
}

async function incremental(scope: MetrcScope, deps: PagerDeps, result: IncrementalResult): Promise<IncrementalResult> {
  const blocked = precheck(scope, deps.env);
  if (blocked) return { ...result, ...blocked };
  const userKey = userKeyFor(deps.env, scope.license) ?? "";
  const budget = deps.budget.forLicense(scope.license);
  const now = deps.now ?? nowIso;
  const at = now();
  const tickNow = isoSeconds(Date.parse(at));
  const pageSize = clampPageSize(deps.config.pageSize);
  const ceiling = deps.pageCeiling ?? METRC_PAGE_CEILING;
  const record = recorder(deps.db, budget, scope.host);
  let cursor = await ensureCursor(deps.db, scope, at, budget);
  result.cursor = cursor;
  if (!cursor.hwm_end) return { ...result, status: "needs_full", message: NEEDS_FULL_WORDS };
  const save = async (next: MetrcCursor): Promise<void> => {
    await saveIncrementalStmt(deps.db, next, at).run();
    budget.spendD1(1);
    cursor = next;
    result.cursor = next;
  };
  for (;;) {
    let winStart = cursor.win_start;
    let winEnd = cursor.win_end;
    if (!winStart || !winEnd) {
      const w = nextWindow({
        hwmEnd: cursor.hwm_end ?? tickNow,
        nowIso: tickNow,
        overlapMinutes: deps.config.windowOverlapMinutes,
        maxMinutes: deps.config.windowMaxMinutes,
      });
      if (!w) {
        await save({ ...cursor, last_status: "ok", last_run_at: at });
        return { ...result, status: "ok" };
      }
      winStart = w.start;
      winEnd = w.end;
      cursor = { ...cursor, win_start: winStart, win_end: winEnd, win_page: 1 };
    }
    const page = Math.max(1, cursor.win_page);
    if (budget.exhausted()) {
      await save({ ...cursor, win_page: page, last_status: "budget", last_run_at: at });
      return { ...result, status: "budget", message: budgetWords(budget.stop()) };
    }
    if (page > ceiling) {
      // The window holds more pages than the ceiling: halve it and read the
      // half from page 1 (the rows already read reach onPage again, which an
      // incremental consumer takes in place). At the floor, stop and say so.
      const halfEnd = halveWindow(winStart, winEnd, cursor.hwm_end);
      if (halfEnd) {
        await save({ ...cursor, win_start: winStart, win_end: halfEnd, win_page: 1, last_status: "window_too_wide", last_run_at: at });
        continue;
      }
      await save({ ...cursor, win_page: page, last_status: "ceiling", last_run_at: at });
      return { ...result, status: "ceiling", message: CEILING_WINDOW_WORDS };
    }
    const res = await readMetrcPage({
      env: deps.env,
      path: scope.endpoint,
      query: { licenseNumber: scope.license, lastModifiedStart: winStart, lastModifiedEnd: winEnd },
      page,
      pageSize,
      userKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      now,
      clock: deps.clock,
      record,
    });
    if (res.kind !== "ok") {
      const stopped = afterStop({ ...cursor, win_page: page }, res, at);
      await save(stopped.cursor);
      return { ...result, status: stopped.status, message: res.message };
    }
    result.pages += 1;
    result.rows += res.rows.length;
    budget.spendRows(res.rows.length);
    try {
      await deps.onPage(res.rows, {
        scope,
        run: "incremental",
        page,
        window: { start: winStart, end: winEnd },
        passId: null,
        passStartedAt: null,
        totalRecords: res.totalRecords,
        budget,
      });
    } catch (err) {
      await save({ ...cursor, win_page: page, last_status: "failed", last_run_at: at, failures: cursor.failures + 1 });
      return { ...result, status: "failed", message: scrubbed(err, deps.env, userKey) };
    }
    if (shortBeforeLastPage(res, pageSize)) {
      // Ruling C2 in the incremental too: 0 rows while TotalPages names later
      // pages means the window was not read whole, so the mark stays, the
      // page is read again next tick (never one past it), and the run says so.
      await save({ ...cursor, win_page: page, last_status: "short", last_http: res.status, last_run_at: at, failures: cursor.failures + 1 });
      return { ...result, status: "short", message: SHORT_WINDOW_WORDS };
    }
    if (seriesDone(res, pageSize)) {
      // Every page of the window is read: only now does the mark move.
      await save({ ...cursor, hwm_end: winEnd, win_start: null, win_end: null, win_page: 0, last_status: "ok", last_http: res.status, last_run_at: at, failures: 0 });
      result.windows += 1;
    } else {
      await save({ ...cursor, win_page: page + 1, last_status: "ok", last_http: res.status, last_run_at: at, failures: 0 });
    }
  }
}

type PassTally = { pages: number; rows: number; cursor: MetrcCursor | null };

/** One scope's full pass, resumable across ticks at full_page. Each page's
 * tags go into metrc_pass_pages; the last page loads them all and returns the
 * seen set. Only a complete pass may mark gone (Phase C); an incomplete one
 * says so and marks nothing. A pass that reaches the page ceiling, or stops
 * on a short page before TotalPages, is dropped (its pages deleted) and is
 * due again at its cadence. A D1 error ends the scope as failed, scrubbed,
 * and never throws past it. */
export async function runFullPass(scope: MetrcScope, deps: PagerDeps): Promise<FullPassResult> {
  const tally: PassTally = { pages: 0, rows: 0, cursor: null };
  try {
    return await fullPass(scope, deps, tally);
  } catch (err) {
    return {
      complete: false,
      status: "failed",
      pages: tally.pages,
      rows: tally.rows,
      message: scrubbed(err, deps.env, userKeyFor(deps.env, scope.license) ?? ""),
      cursor: tally.cursor,
    };
  }
}

async function fullPass(scope: MetrcScope, deps: PagerDeps, tally: PassTally): Promise<FullPassResult> {
  const stopped = (status: ScopeStatus, message: string | null, cursor: MetrcCursor | null): FullPassStopped => ({
    complete: false,
    status,
    pages: tally.pages,
    rows: tally.rows,
    message,
    cursor,
  });
  const blocked = precheck(scope, deps.env);
  if (blocked) return stopped(blocked.status, blocked.message, null);
  const userKey = userKeyFor(deps.env, scope.license) ?? "";
  const budget = deps.budget.forLicense(scope.license);
  const now = deps.now ?? nowIso;
  const at = now();
  const pageSize = clampPageSize(deps.config.pageSize);
  const ceiling = deps.pageCeiling ?? METRC_PAGE_CEILING;
  const cadenceHours = fullCadenceHours(deps.config, scope.kind);
  const record = recorder(deps.db, budget, scope.host);
  let cursor = await ensureCursor(deps.db, scope, at, budget);
  tally.cursor = cursor;
  if (!cursor.full_pass_id || !cursor.full_started_at) {
    cursor = {
      ...cursor,
      full_pass_id: crypto.randomUUID(),
      full_started_at: isoSeconds(Date.parse(at)),
      full_page: 1,
      full_total_pages: null,
      full_total_records: null,
      full_rows_seen: 0,
    };
  }
  const passId = cursor.full_pass_id as string;
  const passStartedAt = cursor.full_started_at as string;
  const save = async (next: MetrcCursor): Promise<void> => {
    await saveFullStmt(deps.db, next, at).run();
    budget.spendD1(1);
    cursor = next;
    tally.cursor = next;
  };
  // A pass that cannot finish is dropped: its pages go, the mark is not set,
  // and it is due again one cadence from now (not from its start, which could
  // already be past and restart it at once).
  const drop = async (status: "ceiling" | "short", message: string, last: Partial<MetrcCursor>): Promise<FullPassStopped> => {
    const dropped: MetrcCursor = {
      ...cursor,
      ...last,
      full_pass_id: null,
      full_page: 0,
      full_due_at: isoSeconds(Date.parse(at) + cadenceHours * 3_600_000),
      last_status: status,
      last_run_at: at,
    };
    await deps.db.batch([saveFullStmt(deps.db, dropped, at), deps.db.prepare(`DELETE FROM metrc_pass_pages WHERE pass_id = ?`).bind(passId)]);
    budget.spendD1(2);
    cursor = dropped;
    tally.cursor = dropped;
    return stopped(status, message, dropped);
  };
  for (;;) {
    const page = Math.max(1, cursor.full_page);
    if (budget.exhausted()) {
      await save({ ...cursor, full_page: page, last_status: "budget", last_run_at: at });
      return stopped("budget", budgetWords(budget.stop()), cursor);
    }
    if (page > ceiling) return drop("ceiling", CEILING_PASS_WORDS, {});
    const res = await readMetrcPage({
      env: deps.env,
      path: scope.endpoint,
      query: { licenseNumber: scope.license },
      page,
      pageSize,
      userKey,
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      now,
      clock: deps.clock,
      record,
    });
    if (res.kind !== "ok") {
      const halt = afterStop({ ...cursor, full_page: page }, res, at);
      await save(halt.cursor);
      return stopped(halt.status, res.message, cursor);
    }
    tally.pages += 1;
    tally.rows += res.rows.length;
    budget.spendRows(res.rows.length);
    const ctx: PageContext = {
      scope,
      run: "full",
      page,
      window: null,
      passId,
      passStartedAt,
      totalRecords: res.totalRecords,
      budget,
    };
    try {
      await deps.onPage(res.rows, ctx);
    } catch (err) {
      await save({ ...cursor, full_page: page, last_status: "failed", last_run_at: at, failures: cursor.failures + 1 });
      return stopped("failed", scrubbed(err, deps.env, userKey), cursor);
    }
    const next: MetrcCursor = {
      ...cursor,
      full_page: page + 1,
      full_total_pages: res.totalPages ?? cursor.full_total_pages,
      full_total_records: res.totalRecords ?? cursor.full_total_records,
      full_rows_seen: cursor.full_rows_seen + res.rows.length,
      last_status: "ok",
      last_http: res.status,
      last_run_at: at,
      failures: 0,
    };
    await deps.db.batch([
      deps.db
        .prepare(
          `INSERT INTO metrc_pass_pages (pass_id, page, tags_json, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (pass_id, page) DO UPDATE SET tags_json = excluded.tags_json, created_at = excluded.created_at`
        )
        .bind(passId, page, JSON.stringify(labelsOf(res.rows)), at),
      saveFullStmt(deps.db, next, at),
    ]);
    budget.spendD1(2);
    cursor = next;
    tally.cursor = next;
    if (!seriesDone(res, pageSize)) continue;
    if (shortBeforeLastPage(res, pageSize)) return drop("short", SHORT_PASS_WORDS, { last_http: res.status });
    const pageRows = await deps.db
      .prepare(`SELECT tags_json FROM metrc_pass_pages WHERE pass_id = ? ORDER BY page`)
      .bind(passId)
      .all<{ tags_json: string }>();
    budget.spendD1(1);
    const seenTags = new Set<string>();
    for (const row of pageRows.results ?? []) {
      try {
        const tags = JSON.parse(String(row.tags_json)) as unknown;
        if (Array.isArray(tags)) for (const tag of tags) seenTags.add(String(tag));
      } catch {
        // A page row that does not parse adds no tag; the pass still knows its count.
      }
    }
    const done: FullPassDone = {
      complete: true,
      seenTags,
      totalRecords: next.full_total_records ?? next.full_rows_seen,
      passId,
      passStartedAt,
      pages: tally.pages,
      rows: tally.rows,
      cursor: next,
    };
    if (deps.onComplete) {
      try {
        await deps.onComplete(done, ctx);
      } catch (err) {
        // The pass stays open at its last page, so the next tick re-reads that
        // page (a page TotalPages names) and completes, never a page past it.
        await save({ ...cursor, full_page: page, last_status: "failed", last_run_at: at, failures: cursor.failures + 1 });
        return stopped("failed", scrubbed(err, deps.env, userKey), cursor);
      }
    }
    const finished: MetrcCursor = {
      ...next,
      full_pass_id: null,
      full_page: 0,
      full_completed_at: isoSeconds(Date.parse(at)),
      full_due_at: fullDueAt(passStartedAt, cadenceHours),
      // A26: the pass sets the mark to its own start when there is none; an
      // existing mark is never moved back or forward by a pass (the save
      // writes it only where the stored mark is empty).
      hwm_end: next.hwm_end ?? passStartedAt,
    };
    await deps.db.batch([saveFullStmt(deps.db, finished, at), deps.db.prepare(`DELETE FROM metrc_pass_pages WHERE pass_id = ?`).bind(passId)]);
    budget.spendD1(2);
    tally.cursor = finished;
    return { ...done, cursor: finished };
  }
}
