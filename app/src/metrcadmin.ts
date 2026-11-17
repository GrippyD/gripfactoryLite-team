/**
 * MA1 Phase D, Law 9 (THE ADMIN SURFACE, G-3): what the /admin/metrc-api page
 * loads beyond the Phase B client's own figures, and the three PIN-gated
 * buttons. The page itself is rendered by metrcApiPage (metrcapi.ts); this
 * module sits above the client, the pager and the sweep and never forks their
 * logic: the scopes are the sweep's own (mirrorScopes), the budget is the
 * pager's pace (pacedTickCalls), Sweep now runs runMirrorSweep inline with
 * opts.only and the metrc_sweep_now_calls cap (A20), Confirm gone sets the
 * cursor's gone_override the sweep consumes on its next complete pass (A29),
 * and Reset cursor soft-deletes the cursor row with a logged reason so the
 * next tick starts a fresh full pass (the Phase C ruling's remedy for a scope
 * stuck on short or ceiling).
 *
 * The parity pane (Findings 6.6) reads the latest dry-run runs on a production
 * host only: sandbox runs are never parity evidence. A location difference is
 * labelled a crew move when the tag's changed_at is later than the created_at
 * of its mount (the floor moved it ahead of Metrc). "Parity reads clean" needs
 * would-add, would-update and would-gone all 0 and no sample across the
 * license's latest runs; anything else reads "Parity differs" with the numbers.
 * No key reaches any of this.
 */

import { nowIso } from "./audit";
import { SYSTEM_REASON, isKnownSiteLicense } from "./config";
import { insertLog } from "./db";
import {
  keysPresent,
  loadMetrcAdmin,
  metrcHost,
  metrcHostKind,
  resolveSweepMode,
  type MetrcAdmin,
  type MetrcCursorLine,
  type MetrcEndpointLine,
  type MetrcEnv,
  type MetrcParityLine,
  type MetrcParityMount,
  type MetrcParityRun,
  type MetrcParitySample,
  type MetrcParityVerdict,
  type MetrcRunLine,
} from "./metrcapi";
import { loadMetrcSweepConfig, pacedTickCalls, ticksLeftInMonth, type CursorMode } from "./metrcpager";
import { FACILITIES_UNCHECKED_WORDS, MIRROR_ENDPOINTS, growsPlants, loadGrowFlags, mirrorScopes, runMirrorSweep, type MirrorSweepOpts } from "./metrcsweep";

/** The endpoint word of the sweep's own skipped row for a license whose
 * plants and harvests wait for Test connection (runMirrorSweep). */
export const UNCHECKED_ENDPOINT = "plants+harvests";

/** A production host as metrc_sweep_runs.host stores it (a hostname, never a URL). */
export const PRODUCTION_HOST_RE = /^api-[a-z]{2}\.metrc\.com$/;

/** The mirror column a crew move shows up in (Findings 6.6). */
export const CREW_MOVE_COLUMN = "location";

// ---------------------------------------------------------------- pure rules

/** Findings 6.6: a location difference is a crew move when the tag changed
 * after its mount was created (the floor moved it; Metrc has not caught up). */
export function isCrewMove(column: string, changedAt: string | null, mountCreatedAt: string | null): boolean {
  if (column !== CREW_MOVE_COLUMN) return false;
  if (!changedAt || !mountCreatedAt) return false;
  const changed = Date.parse(changedAt);
  const mounted = Date.parse(mountCreatedAt);
  if (!Number.isFinite(changed) || !Number.isFinite(mounted)) return false;
  return changed > mounted;
}

export type ParityTotals = { add: number; update: number; gone: number; held: number; samples: number };

export function parityTotals(runs: readonly MetrcParityRun[], samples: number): ParityTotals {
  const totals: ParityTotals = { add: 0, update: 0, gone: 0, held: 0, samples };
  for (const run of runs) {
    totals.add += run.would_add;
    totals.update += run.would_update;
    totals.gone += run.would_gone;
    totals.held += run.gone_held === 1 ? 1 : 0;
  }
  return totals;
}

/** Law 9: one sentence. none until a complete full pass (the comparison of
 * the whole mirror) exists on production; clean only when every count is 0
 * and no sample differs across the pooled evidence; otherwise differs. */
export function parityVerdict(runs: readonly MetrcParityRun[], totals: ParityTotals): MetrcParityVerdict {
  if (!runs.some((run) => run.run_kind === "full")) return "none";
  if (totals.add === 0 && totals.update === 0 && totals.gone === 0 && totals.samples === 0) return "clean";
  return "differs";
}

/** Whole hours between two stamps, never negative. */
export function ageHours(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.floor((to - from) / 3_600_000));
}

// ---------------------------------------------------------------- loaders

type CursorRow = {
  id: string;
  license_value: string;
  endpoint: string;
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
  updated_at: string;
};

type RunRow = {
  id: string;
  host: string;
  license_value: string;
  endpoint: string;
  kind: string;
  started_at: string;
  run_kind: string;
  mode: string;
  rows: number | null;
  calls: number | null;
  failures: number | null;
  would_add: number | null;
  would_update: number | null;
  would_gone: number | null;
  gone_held: number;
  status: string;
  message: string | null;
};

const RUN_COLUMNS = "id, host, license_value, endpoint, kind, started_at, run_kind, mode, rows, calls, failures, would_add, would_update, would_gone, gone_held, status, message";

/** The latest run row per license and endpoint on one host (any kind and
 * mode). One tick runs a scope's incremental before its full pass, so a tie
 * on started_at (a frozen clock) reads the full pass as the later one: "full"
 * sorts before "incremental". */
async function latestRunsOnHost(db: D1Database, host: string): Promise<RunRow[]> {
  const out = await db
    .prepare(
      `SELECT ${RUN_COLUMNS} FROM metrc_sweep_runs r
       WHERE r.host = ? AND r.deleted_at IS NULL
         AND r.id = (SELECT r2.id FROM metrc_sweep_runs r2
                     WHERE r2.host = r.host AND r2.license_value = r.license_value AND r2.endpoint = r.endpoint AND r2.deleted_at IS NULL
                     ORDER BY r2.started_at DESC, r2.run_kind ASC, r2.id DESC LIMIT 1)`
    )
    .bind(host)
    .all<RunRow>();
  return out.results ?? [];
}

/** The latest complete full pass per license and endpoint on one host in one
 * mode: the row the gone hold (A29) belongs to, which outlives the
 * incrementals that follow it until the next complete pass of that cursor. A
 * complete pass is a full run with status ok; a partial pass (budget, short,
 * ceiling) or a failed one is not a comparison of the whole mirror. */
async function latestFullRunsOnHost(db: D1Database, host: string, mode: CursorMode): Promise<RunRow[]> {
  const out = await db
    .prepare(
      `SELECT ${RUN_COLUMNS} FROM metrc_sweep_runs r
       WHERE r.host = ? AND r.mode = ? AND r.run_kind = 'full' AND r.status = 'ok' AND r.deleted_at IS NULL
         AND r.id = (SELECT r2.id FROM metrc_sweep_runs r2
                     WHERE r2.host = r.host AND r2.license_value = r.license_value AND r2.endpoint = r.endpoint
                       AND r2.mode = r.mode AND r2.run_kind = 'full' AND r2.status = 'ok' AND r2.deleted_at IS NULL
                     ORDER BY r2.started_at DESC, r2.id DESC LIMIT 1)`
    )
    .bind(host, mode)
    .all<RunRow>();
  return out.results ?? [];
}

/** The parity evidence: per host, license, endpoint and run kind, the latest
 * complete (status ok) dry-run row on the production hosts. The full pass is
 * the comparison of the whole mirror and the incremental the window's; both
 * count, so a quiet hour's empty incremental never hides a differing pass,
 * and a partial, refused or failed run carries no evidence. The host filter
 * is the regex, not LIKE. */
async function latestProductionDryRuns(db: D1Database, licenses: readonly string[]): Promise<RunRow[]> {
  if (licenses.length === 0) return [];
  const marks = licenses.map(() => "?").join(", ");
  const out = await db
    .prepare(
      `SELECT ${RUN_COLUMNS} FROM metrc_sweep_runs r
       WHERE r.mode = 'dry_run' AND r.status = 'ok' AND r.run_kind IN ('full', 'incremental')
         AND r.deleted_at IS NULL AND r.host LIKE 'api-%' AND r.license_value IN (${marks})
         AND r.id = (SELECT r2.id FROM metrc_sweep_runs r2
                     WHERE r2.host = r.host AND r2.license_value = r.license_value AND r2.endpoint = r.endpoint AND r2.run_kind = r.run_kind
                       AND r2.mode = 'dry_run' AND r2.status = 'ok' AND r2.deleted_at IS NULL
                     ORDER BY r2.started_at DESC, r2.id DESC LIMIT 1)
       ORDER BY r.license_value, r.endpoint, r.run_kind`
    )
    .bind(...licenses)
    .all<RunRow>();
  return (out.results ?? []).filter((row) => PRODUCTION_HOST_RE.test(String(row.host)));
}

type SampleRow = { run_id: string; tag: string; column_name: string; mirror_value: string | null; api_value: string | null };

async function samplesOf(db: D1Database, runIds: readonly string[]): Promise<SampleRow[]> {
  const rows: SampleRow[] = [];
  for (let i = 0; i < runIds.length; i += 90) {
    const chunk = runIds.slice(i, i + 90);
    const marks = chunk.map(() => "?").join(", ");
    const out = await db
      .prepare(`SELECT run_id, tag, column_name, mirror_value, api_value FROM metrc_sweep_samples WHERE run_id IN (${marks}) ORDER BY created_at, id`)
      .bind(...chunk)
      .all<SampleRow>();
    rows.push(...(out.results ?? []));
  }
  return rows;
}

type StampRow = { key: string; changed_at: string | null; mount_created_at: string | null };

/** The mirror row's changed_at and its mount's created_at, by kind and key. */
async function mirrorStamps(db: D1Database, kind: string, keys: readonly string[]): Promise<Map<string, StampRow>> {
  const out = new Map<string, StampRow>();
  if (keys.length === 0) return out;
  const table = kind === "plants" ? "metrc_plants" : kind === "harvests" ? "metrc_harvests" : "metrc_packages";
  const keyColumn = kind === "harvests" ? "CAST(x.harvest_id AS TEXT)" : "x.tag";
  const where = kind === "harvests" ? "x.harvest_id" : "x.tag";
  for (let i = 0; i < keys.length; i += 90) {
    const chunk = keys.slice(i, i + 90);
    const marks = chunk.map(() => "?").join(", ");
    const rows = await db
      .prepare(
        `SELECT ${keyColumn} AS key, x.changed_at, m.created_at AS mount_created_at
         FROM ${table} x LEFT JOIN metrc_mounts m ON m.id = x.mount_id WHERE ${where} IN (${marks})`
      )
      .bind(...(kind === "harvests" ? chunk.map((key) => Number(key)) : chunk))
      .all<StampRow>();
    for (const row of rows.results ?? []) out.set(String(row.key), row);
  }
  return out;
}

type MountRow = { license_value: string; kind: string; phase: string | null; created_at: string };

/** The newest file mount per license, kind and phase (the CSV door's). */
async function newestFileMounts(db: D1Database, licenses: readonly string[]): Promise<MountRow[]> {
  if (licenses.length === 0) return [];
  const marks = licenses.map(() => "?").join(", ");
  const out = await db
    .prepare(
      `SELECT license_value, kind, phase, MAX(created_at) AS created_at FROM metrc_mounts
       WHERE source = 'file' AND deleted_at IS NULL AND license_value IN (${marks})
       GROUP BY license_value, kind, phase ORDER BY license_value, kind, phase`
    )
    .bind(...licenses)
    .all<MountRow>();
  return out.results ?? [];
}

function cursorLine(row: CursorRow): MetrcCursorLine {
  return {
    id: String(row.id),
    mode: String(row.mode),
    hwm_end: row.hwm_end ?? null,
    full_pass_id: row.full_pass_id ?? null,
    full_page: Number(row.full_page ?? 0),
    full_total_pages: row.full_total_pages == null ? null : Number(row.full_total_pages),
    full_completed_at: row.full_completed_at ?? null,
    full_due_at: row.full_due_at ?? null,
    gone_override: Number(row.gone_override ?? 0),
    last_status: row.last_status ?? null,
    last_run_at: row.last_run_at ?? null,
    failures: Number(row.failures ?? 0),
  };
}

function runLine(row: RunRow): MetrcRunLine {
  return {
    id: String(row.id),
    started_at: String(row.started_at),
    run_kind: String(row.run_kind),
    mode: String(row.mode),
    rows: row.rows == null ? null : Number(row.rows),
    calls: row.calls == null ? null : Number(row.calls),
    failures: row.failures == null ? null : Number(row.failures),
    status: String(row.status),
    message: row.message ?? null,
    would_gone: row.would_gone == null ? null : Number(row.would_gone),
    gone_held: Number(row.gone_held ?? 0),
  };
}

function scopeKey(license: string, endpoint: string): string {
  return `${license.trim().toUpperCase()}|${endpoint}`;
}

/** Law 9: the parity pane's lines, per lookup license. Exported for the tests;
 * the page calls it through loadMetrcAdminPage. */
export async function loadParity(db: D1Database, licenses: readonly string[], at: string): Promise<MetrcParityLine[]> {
  const runs = await latestProductionDryRuns(db, licenses);
  const samples = await samplesOf(db, runs.map((run) => run.id));
  const runById = new Map(runs.map((run) => [run.id, run]));
  // The crew-move rule needs each sampled tag's stamps, by the run's kind.
  const keysByKind = new Map<string, Set<string>>();
  for (const sample of samples) {
    const run = runById.get(sample.run_id);
    if (!run || sample.column_name !== CREW_MOVE_COLUMN) continue;
    const set = keysByKind.get(run.kind) ?? new Set<string>();
    set.add(String(sample.tag));
    keysByKind.set(run.kind, set);
  }
  const stampsByKind = new Map<string, Map<string, StampRow>>();
  for (const [kind, keys] of keysByKind) stampsByKind.set(kind, await mirrorStamps(db, kind, [...keys]));
  const mounts = await newestFileMounts(db, licenses);
  const out: MetrcParityLine[] = [];
  for (const license of licenses) {
    const own = runs.filter((run) => run.license_value.trim().toUpperCase() === license.trim().toUpperCase());
    const ownIds = new Set(own.map((run) => run.id));
    const parityRuns: MetrcParityRun[] = own.map((run) => ({
      endpoint: run.endpoint,
      run_kind: String(run.run_kind),
      started_at: run.started_at,
      would_add: Number(run.would_add ?? 0),
      would_update: Number(run.would_update ?? 0),
      would_gone: Number(run.would_gone ?? 0),
      gone_held: Number(run.gone_held ?? 0),
    }));
    const paritySamples: MetrcParitySample[] = [];
    for (const sample of samples) {
      if (!ownIds.has(sample.run_id)) continue;
      const run = runById.get(sample.run_id);
      const stamp = run ? stampsByKind.get(run.kind)?.get(String(sample.tag)) : undefined;
      paritySamples.push({
        endpoint: run?.endpoint ?? "",
        tag: String(sample.tag),
        column: String(sample.column_name),
        mirrorValue: sample.mirror_value ?? null,
        apiValue: sample.api_value ?? null,
        crewMove: isCrewMove(String(sample.column_name), stamp?.changed_at ?? null, stamp?.mount_created_at ?? null),
      });
    }
    const ownMounts: MetrcParityMount[] = mounts
      .filter((mount) => mount.license_value.trim().toUpperCase() === license.trim().toUpperCase())
      .map((mount) => ({ kind: String(mount.kind), phase: mount.phase ?? null, created_at: String(mount.created_at), ageHours: ageHours(String(mount.created_at), at) }));
    const totals = parityTotals(parityRuns, paritySamples.length);
    out.push({ license, runs: parityRuns, samples: paritySamples, mounts: ownMounts, verdict: parityVerdict(parityRuns, totals), totals });
  }
  return out;
}

/** Everything /admin/metrc-api shows: the Phase B figures (loadMetrcAdmin) plus
 * the mode, the budget as the pace computes it, one line per scope of the
 * mirror sweep with its cursor and latest run, the Sweep now choices, and the
 * parity pane. One read per table; no key is read here. */
/** The mode whose cursors the page shows and the buttons act on (A26: each
 * mode keeps its own): write when the host law resolves write, else dry_run
 * (an off mode shows the dry runs' cursors). */
export async function resolvedCursorMode(env: MetrcEnv): Promise<CursorMode> {
  const config = await loadMetrcSweepConfig(env.DB);
  return resolveSweepMode(env, config.sweepMode).mode === "write" ? "write" : "dry_run";
}

export async function loadMetrcAdminPage(env: MetrcEnv, at: string = nowIso()): Promise<MetrcAdmin> {
  const base = await loadMetrcAdmin(env, at);
  const host = base.host;
  const config = await loadMetrcSweepConfig(env.DB);
  const resolved = resolveSweepMode(env, config.sweepMode);
  const hostKind = metrcHostKind(env);
  const licenses = (base.licenses ?? []).map((row) => row.license).filter(isKnownSiteLicense);
  const flags = await loadGrowFlags(env.DB, host);
  // The scopes are the sweep's own (runMirrorSweep): a license whose
  // facilities row says it cannot grow plants is swept for packages only, and
  // one not checked yet on this host is swept for packages while its plants
  // and harvests wait for Test connection, which the sweep records as one
  // skipped row per tick; the page lists that line with the sweep's reason.
  const cursorMode: CursorMode = resolved.mode === "write" ? "write" : "dry_run";
  const scopes = mirrorScopes(host, cursorMode, licenses, (license) => growsPlants(license, flags) === "grow");
  const unchecked = licenses.filter((license) => growsPlants(license, flags) === "unchecked");
  const [cursorRows, runRows, fullRows] = await Promise.all([
    env.DB.prepare(
      `SELECT id, license_value, endpoint, mode, hwm_end, full_pass_id, full_page, full_total_pages, full_completed_at, full_due_at,
              gone_override, last_status, last_run_at, failures, updated_at
       FROM metrc_cursors WHERE host = ? AND mode = ? AND deleted_at IS NULL ORDER BY updated_at DESC`
    )
      .bind(host, cursorMode)
      .all<CursorRow>(),
    latestRunsOnHost(env.DB, host),
    latestFullRunsOnHost(env.DB, host, cursorMode),
  ]);
  // The resolved mode's cursor only (each mode keeps its own, A26): the other
  // mode's cursor is never shown nor offered a button.
  const cursorsByScope = new Map((cursorRows.results ?? []).map((row) => [scopeKey(String(row.license_value), String(row.endpoint)), row]));
  const runsByScope = new Map(runRows.map((row) => [scopeKey(String(row.license_value), String(row.endpoint)), row]));
  const fullByScope = new Map(fullRows.map((row) => [scopeKey(String(row.license_value), String(row.endpoint)), row]));
  const endpoints: MetrcEndpointLine[] = scopes.map((scope) => {
    const key = scopeKey(scope.license, scope.endpoint);
    const cursor = cursorsByScope.get(key) ?? null;
    const run = runsByScope.get(key) ?? null;
    const full = fullByScope.get(key) ?? null;
    const held = full != null && Number(full.gone_held) === 1;
    return {
      license: scope.license,
      endpoint: scope.endpoint,
      kind: scope.kind,
      phase: scope.phase,
      cursor: cursor ? cursorLine(cursor) : null,
      run: run ? runLine(run) : null,
      heldGone: held ? Number(full.would_gone ?? 0) : null,
      heldRun: held ? String(full.id) : null,
      note: null,
    };
  });
  for (const license of unchecked) {
    const run = runsByScope.get(scopeKey(license, UNCHECKED_ENDPOINT)) ?? null;
    endpoints.push({
      license,
      endpoint: UNCHECKED_ENDPOINT,
      kind: "plants",
      phase: null,
      cursor: null,
      run: run ? runLine(run) : null,
      heldGone: null,
      heldRun: null,
      note: FACILITIES_UNCHECKED_WORDS,
    });
  }
  const ticksLeft = ticksLeftInMonth(at);
  const nextTickCalls = pacedTickCalls({ tickCalls: config.tickCalls, monthCalls: config.monthCalls, usedThisMonth: base.calls, ticksLeft, scopes: scopes.length });
  const parity = await loadParity(env.DB, licenses, at);
  return {
    ...base,
    mode: { hostKind, configured: config.sweepMode, resolved: resolved.mode, refusal: resolved.refusal },
    budget: {
      monthCalls: config.monthCalls,
      remaining: Math.max(0, config.monthCalls - base.calls),
      nextTickCalls,
      ticksLeft,
      tickCalls: config.tickCalls,
      sweepNowCalls: config.sweepNowCalls,
    },
    endpoints,
    sweepLicenses: licenses,
    sweepEndpoints: [...MIRROR_ENDPOINTS],
    parity,
  };
}

// ---------------------------------------------------------------- the buttons

export type SweepNowCode = "swept" | "sweep_absent" | "sweep_host" | "sweep_off" | "sweep_unknown" | "sweep_failed";
export type SweepNowOutcome = { code: SweepNowCode; calls: number; runs: number };

/** Law 9 and A20: Sweep now for one license and endpoint, inline, in the
 * resolved mode, within metrc_sweep_now_calls. Refused in plain words, with no
 * call, when a key is absent, the host is not a Metrc host, the mode is off,
 * or the license or endpoint is not one the sweep reads. The sweep itself
 * honours the budget and the host law (write mode is impossible on a sandbox
 * or stub host). */
export async function sweepNowAction(env: MetrcEnv, form: FormData, opts: Pick<MirrorSweepOpts, "fetchImpl" | "sleep" | "now" | "clock"> = {}): Promise<SweepNowOutcome> {
  const license = String(form.get("license") ?? "").trim();
  const endpoint = String(form.get("endpoint") ?? "").trim();
  const keys = keysPresent(env);
  if (!keys.integrator || !keys.user) return { code: "sweep_absent", calls: 0, runs: 0 };
  if (metrcHostKind(env) === "other") return { code: "sweep_host", calls: 0, runs: 0 };
  const config = await loadMetrcSweepConfig(env.DB);
  const resolved = resolveSweepMode(env, config.sweepMode);
  if (resolved.mode === "off") return { code: "sweep_off", calls: 0, runs: 0 };
  if (!isKnownSiteLicense(license) || !MIRROR_ENDPOINTS.includes(endpoint)) return { code: "sweep_unknown", calls: 0, runs: 0 };
  const result = await runMirrorSweep(env, "admin", { ...opts, only: { license, endpoint }, calls: config.sweepNowCalls, retention: false });
  if (result.status === "failed") return { code: "sweep_failed", calls: result.calls, runs: result.runs };
  if (result.status === "skipped") return { code: "sweep_unknown", calls: 0, runs: 0 };
  return { code: "swept", calls: result.calls, runs: result.runs };
}

export type ConfirmGoneCode = "gone_confirmed" | "gone_unknown" | "gone_not_held";

/** A29: Confirm gone sets gone_override on one live cursor of this host in
 * the resolved mode (A26: a confirmation given from a dry_run page never arms
 * the write cursor) and nothing else; the sweep's next complete pass of that
 * cursor marks once and resets it. The form names the held pass, which must
 * still be the scope's latest complete pass with the guard held, so a stale
 * page (the hold cleared or re-held since) and a direct POST on a calm scope
 * read gone_not_held and change nothing. The change is logged with the actor. */
export async function confirmGoneAction(env: MetrcEnv, form: FormData, at: string = nowIso()): Promise<ConfirmGoneCode> {
  const id = String(form.get("cursor") ?? "").trim();
  const runId = String(form.get("run") ?? "").trim();
  const actor = String(form.get("person_id") ?? "").trim() || null;
  if (!id) return "gone_unknown";
  const host = metrcHost(env);
  const mode = await resolvedCursorMode(env);
  const row = await env.DB.prepare(`SELECT id, license_value, endpoint, gone_override FROM metrc_cursors WHERE id = ? AND host = ? AND mode = ? AND deleted_at IS NULL`)
    .bind(id, host, mode)
    .first<{ id: string; license_value: string; endpoint: string; gone_override: number }>();
  if (!row) return "gone_unknown";
  const full = (await latestFullRunsOnHost(env.DB, host, mode)).find((run) => scopeKey(String(run.license_value), String(run.endpoint)) === scopeKey(String(row.license_value), String(row.endpoint)));
  if (!full || Number(full.gone_held) !== 1 || !runId || String(full.id) !== runId) return "gone_not_held";
  await env.DB.batch([
    env.DB.prepare(`UPDATE metrc_cursors SET gone_override = 1, updated_at = ?, updated_by = ? WHERE id = ? AND host = ? AND mode = ? AND deleted_at IS NULL`).bind(at, actor, id, host, mode),
    insertLog(env.DB, {
      record_table: "metrc_cursors",
      record_id: id,
      field: "gone_override",
      old_value: String(Number(row.gone_override ?? 0)),
      new_value: "1",
      actor_person_id: actor,
      reason: SYSTEM_REASON.metrc_gone_confirmed,
      changed_at: at,
    }),
  ]);
  return "gone_confirmed";
}

export type ResetCursorCode = "cursor_reset" | "cursor_unknown";

/** The Phase C ruling's remedy: soft-delete one live cursor of this host in
 * the resolved mode (A26: a reset from a dry_run page never discards the
 * write cursor's progress), its pass pages with it, with a logged reason, so
 * the next tick starts a fresh full pass for the scope. The run log is
 * untouched. */
export async function resetCursorAction(env: MetrcEnv, form: FormData, at: string = nowIso()): Promise<ResetCursorCode> {
  const id = String(form.get("cursor") ?? "").trim();
  const actor = String(form.get("person_id") ?? "").trim() || null;
  if (!id) return "cursor_unknown";
  const host = metrcHost(env);
  const mode = await resolvedCursorMode(env);
  const row = await env.DB.prepare(`SELECT id, full_pass_id FROM metrc_cursors WHERE id = ? AND host = ? AND mode = ? AND deleted_at IS NULL`)
    .bind(id, host, mode)
    .first<{ id: string; full_pass_id: string | null }>();
  if (!row) return "cursor_unknown";
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE metrc_cursors SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ? AND host = ? AND mode = ? AND deleted_at IS NULL`).bind(
      at,
      actor,
      at,
      actor,
      id,
      host,
      mode
    ),
    insertLog(env.DB, {
      record_table: "metrc_cursors",
      record_id: id,
      field: "deleted_at",
      old_value: null,
      new_value: at,
      actor_person_id: actor,
      reason: SYSTEM_REASON.metrc_cursor_reset,
      changed_at: at,
    }),
  ];
  if (row.full_pass_id) stmts.push(env.DB.prepare(`DELETE FROM metrc_pass_pages WHERE pass_id = ?`).bind(String(row.full_pass_id)));
  await env.DB.batch(stmts);
  return "cursor_reset";
}
