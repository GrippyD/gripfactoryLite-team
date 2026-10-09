/**
 * MA1 Phase C, Laws 5 and 7: the mirror sweep by API, the second door into
 * THE MIRROR LAW's one reconcile (Law 1, ONE DOOR, TWO PATHS). It runs on its
 * own cron string (45 past the hour, A28), reads through the Phase B pager
 * (metrcpager.ts: cursors, windows, full passes, the budget) and feeds every
 * page to planMirrorPass (metrc.ts), the same reconcile the CSV drop calls.
 *
 * - Mode (Law 3 and Law 7): resolveSweepMode decides once; the sweep never
 *   re-decides. off records one skipped run row and reads nothing. dry_run
 *   reads everything it would read, plans in memory against the current
 *   mirror, writes nothing to metrc_plants, metrc_packages, metrc_harvests or
 *   metrc_mounts, and records the would-add, would-update and would-gone
 *   counts, the gone hold and up to metrc_sample_cap sample differences per
 *   run. write (a production host only) writes through writeMirrorPass behind
 *   one API mount per license, kind and phase per UTC day (A30), with actor
 *   null (A15), then afterPackagesPass.
 * - Scopes per tick: packages active for every lookup license; plants
 *   vegetative and flowering and harvests active and inactive for the licenses
 *   whose metrc_facilities row on this host says CanGrowPlants (a license
 *   with no row yet counts as grow once Test connection has run on this host;
 *   before that its plants and harvests wait, and a run row says so).
 * - Order inside the budget: incrementals first (every scope with a mark),
 *   then the full passes due, packages and harvests (daily) before plants
 *   (weekly, spread across ticks). An empty write cursor runs a complete full
 *   pass before any incremental (A26, the pager's needs_full).
 * - Gone (A10, A19, A29): only a complete full pass marks gone, within its
 *   license and phase, after the kind's onhold list is read into the seen set
 *   within the same budget (plants count within the phase their GrowthPhase
 *   names; harvests on hold update to state onhold). Rows changed or first
 *   seen after the pass began are never gone. The mass-gone guard holds the
 *   marks when the full pass itself read 0 rows (its own count across its
 *   ticks, not the onhold or incremental reads) against live rows, or would
 *   mark more than metrc_gone_hold_share of them, unless the cursor's
 *   gone_override is set (then the next complete pass marks once and the
 *   override resets, whether or not the guard would have held). The pass's
 *   seen keys are upper-cased like the mirror's tags. An incremental never
 *   marks gone. Harvests: a state change is an in-place update; inactive rows
 *   outside the finished-days scope are not inserted (a row the mirror holds
 *   still takes its inactive state); the inactive list's full pass marks
 *   nothing gone.
 * - Re-delivered rows (a halved window reads from page 1 again) are deduped
 *   by key within a tick: the first delivery is reconciled, later ones are
 *   counted as seen only.
 * - One metrc_sweep_runs row per license per endpoint per run, never per row.
 *   The tick's own notes (off, keys absent, a refused write) are one row with
 *   license "*". metrc_api_calls.host is filled on every call.
 * - Retention (A30): a cron tick ends by pruning metrc_api_calls, metrc_sweeps
 *   and metrc_sweep_runs (samples with their runs) older than
 *   metrc_log_keep_days (never under 31 days: the month pace reads the call
 *   log, A18), at most 500 rows per statement and 10 statements.
 * - Nothing here throws past the sweep; a failure records one failed run row.
 *   internal_field_values is never touched. The lab sweep is not this sweep.
 */

import { nowIso } from "./audit";
import { isKnownSiteLicense, SYSTEM_REASON, type MetrcSweepConfig } from "./config";
import {
  afterPackagesPass,
  loadExistingByKeys,
  loadLiveKeys,
  mirrorKeyOf,
  mountRowStmts,
  planMirrorPass,
  writeMirrorPass,
  type MetrcHarvestRow,
  type MirrorKind,
  type MirrorPlan,
  type MirrorSample,
  type MountCounts,
} from "./metrc";
import { harvestInScope, packageApiRow, plantApiRow, plantGrowthPhase, shapeHarvestRow, type HarvestState } from "./metrcmap";
import {
  absentWords,
  basicToken,
  keysPresent,
  lookupLicenses,
  metrcHost,
  resolveSweepMode,
  scrubKeys,
  userKeyFor,
  type MetrcEnv,
  type MetrcTrigger,
  type SweepMode,
} from "./metrcapi";
import {
  METRC_PAGE_CEILING,
  MetrcBudget,
  clampPageSize,
  loadCursor,
  loadMetrcSweepConfig,
  needsFullPass,
  readMetrcPage,
  recorder,
  runFullPass,
  runIncremental,
  seriesDone,
  startTickBudget,
  tickLimits,
  type CursorMode,
  type FullPassDone,
  type MetrcScope,
  type PageContext,
  type PagerDeps,
  type ScopeStatus,
} from "./metrcpager";

/** The mirror sweep's own cron string on env.grip (A28). */
export const MIRROR_CRON = "45 * * * *";

/** The scheduled handler routes a cron string that fires at 45 past here. */
export function isMirrorCron(cron: string): boolean {
  return /^45\s/.test(String(cron ?? "").trim());
}

export const PACKAGES_ACTIVE = "/packages/v2/active";
export const PLANTS_VEGETATIVE = "/plants/v2/vegetative";
export const PLANTS_FLOWERING = "/plants/v2/flowering";
export const HARVESTS_ACTIVE = "/harvests/v2/active";
export const HARVESTS_INACTIVE = "/harvests/v2/inactive";
/** The lists a complete full pass reads into its seen set (A10). */
export const ONHOLD_ENDPOINTS: Record<MirrorKind, string> = {
  plants: "/plants/v2/onhold",
  packages: "/packages/v2/onhold",
  harvests: "/harvests/v2/onhold",
};
export const MIRROR_ENDPOINTS: readonly string[] = [PACKAGES_ACTIVE, PLANTS_VEGETATIVE, PLANTS_FLOWERING, HARVESTS_ACTIVE, HARVESTS_INACTIVE];
/** The harvests mount's filename: one mount a day serves both harvest lists (A30). */
export const HARVESTS_MOUNT_NAME = "/harvests/v2/active+inactive";
/** The retention floor (A18): the month pace counts this month's calls, so the call log keeps at least 31 days. */
export const METRC_LOG_KEEP_FLOOR_DAYS = 31;

export const SWEEP_OFF_WORDS = "The sweep mode is off.";
export const FACILITIES_UNCHECKED_WORDS = "Plants and harvests wait for Test connection: metrc_facilities has no row for this license on this host.";
export const GONE_HELD_WORDS = "The gone marks were held (A29): the pass read too few rows against the live rows. Confirm on the Admin page to mark them.";
export const ONHOLD_INCOMPLETE_WORDS = "The onhold list could not be read whole, so the pass stays open and marks nothing gone.";
export const ONLY_UNKNOWN_WORDS = "Sweep now names a license or endpoint this sweep does not read.";
export const TICK_LICENSE = "*";
export const TICK_ENDPOINT = "*";

export type MirrorSweepOpts = {
  /** Sweep now (Phase D): one license and endpoint only. */
  only?: { license: string; endpoint: string } | null;
  /** Sweep now: the tick's call budget, capped under the paced budget. */
  calls?: number;
  /** A cron tick prunes the logs at its end; admin runs do not unless asked. */
  retention?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
  clock?: () => number;
};

export type MirrorSweepResult = {
  mode: SweepMode;
  /** Scope runs recorded this tick (the tick's own "*" rows not counted). */
  runs: number;
  calls: number;
  status: "ok" | "skipped" | "failed";
  message: string | null;
};

export type SweepRunRow = {
  id: string;
  host: string;
  license_value: string;
  endpoint: string;
  kind: string;
  phase: string | null;
  mode: string;
  run_kind: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  win_start: string | null;
  win_end: string | null;
  pages: number | null;
  rows: number | null;
  total_records: number | null;
  calls: number | null;
  failures: number | null;
  would_add: number | null;
  would_update: number | null;
  would_gone: number | null;
  gone_held: number;
  status: string;
  message: string | null;
};

// ---------------------------------------------------------------- scopes

export type GrowFlags = { checked: boolean; grow: Map<string, boolean> };

/** The facilities check of this host (A33): whether Test connection has run
 * here at all, and CanGrowPlants per license. */
export async function loadGrowFlags(db: D1Database, host: string): Promise<GrowFlags> {
  const rows = await db
    .prepare(`SELECT license_value, can_grow_plants FROM metrc_facilities WHERE host = ?`)
    .bind(host)
    .all<{ license_value: string; can_grow_plants: number | null }>();
  const grow = new Map<string, boolean>();
  for (const row of rows.results ?? []) grow.set(String(row.license_value).trim().toUpperCase(), Number(row.can_grow_plants) === 1);
  return { checked: (rows.results ?? []).length > 0, grow };
}

export type GrowAnswer = "grow" | "packages_only" | "unchecked";

/** A license with a facilities row follows its CanGrowPlants; one without a
 * row counts as grow once Test connection has run on this host, else waits. */
export function growsPlants(license: string, flags: GrowFlags): GrowAnswer {
  const hit = flags.grow.get(license.trim().toUpperCase());
  if (hit !== undefined) return hit ? "grow" : "packages_only";
  return flags.checked ? "grow" : "unchecked";
}

/** The tick's scopes in incremental order: packages for every license, then
 * the grow licenses' plants (both phases) and harvests. The inactive harvest
 * list goes before the active one so a harvest that moved to inactive is
 * seen (and takes its state) before the active pass judges gone (A19). */
export function mirrorScopes(host: string, mode: CursorMode, licenses: readonly string[], grows: (license: string) => boolean): MetrcScope[] {
  const scopes: MetrcScope[] = [];
  for (const license of licenses) scopes.push({ host, license, endpoint: PACKAGES_ACTIVE, mode, kind: "packages", phase: null });
  for (const license of licenses) {
    if (!grows(license)) continue;
    scopes.push({ host, license, endpoint: PLANTS_VEGETATIVE, mode, kind: "plants", phase: "vegetative" });
    scopes.push({ host, license, endpoint: PLANTS_FLOWERING, mode, kind: "plants", phase: "flowering" });
    scopes.push({ host, license, endpoint: HARVESTS_INACTIVE, mode, kind: "harvests", phase: null });
    scopes.push({ host, license, endpoint: HARVESTS_ACTIVE, mode, kind: "harvests", phase: null });
  }
  return scopes;
}

/** The full passes run packages and harvests (daily) before plants (weekly). */
const FULL_PASS_ORDER: readonly MirrorKind[] = ["packages", "harvests", "plants"];

function harvestStateOf(endpoint: string): HarvestState {
  return endpoint === HARVESTS_INACTIVE ? "inactive" : endpoint === ONHOLD_ENDPOINTS.harvests ? "onhold" : "active";
}

// ---------------------------------------------------------------- the tick

type MountState = {
  id: string;
  counts: MountCounts;
  rowsTotal: number;
  /** The mount row's insert, run ahead of the first write of the tick. */
  lead: D1PreparedStatement[];
};

type Tick = {
  db: D1Database;
  env: MetrcEnv;
  host: string;
  mode: CursorMode;
  config: MetrcSweepConfig;
  budget: MetrcBudget;
  trigger: MetrcTrigger;
  at: string;
  now: () => string;
  clock: () => number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Keys seen this tick per license, kind and phase (every read of the kind). */
  seen: Map<string, Set<string>>;
  /** Keys reconciled this tick per scope (the dedupe of re-delivered rows). */
  handled: Map<string, Set<string>>;
  /** The day's API mounts per license, kind and phase (write mode). */
  mounts: Map<string, MountState>;
  runs: number;
};

type ScopeTally = {
  pages: number;
  rows: number;
  totalRecords: number | null;
  add: number;
  update: number;
  unchanged: number;
  gone: number;
  wouldGone: number;
  goneHeld: boolean;
  labStateChanged: number;
  samples: MirrorSample[];
  notes: string[];
  complete: boolean;
  phaseMismatch: number;
  outOfScope: number;
  winStart: string | null;
  winEnd: string | null;
};

function newTally(): ScopeTally {
  return {
    pages: 0,
    rows: 0,
    totalRecords: null,
    add: 0,
    update: 0,
    unchanged: 0,
    gone: 0,
    wouldGone: 0,
    goneHeld: false,
    labStateChanged: 0,
    samples: [],
    notes: [],
    complete: false,
    phaseMismatch: 0,
    outOfScope: 0,
    winStart: null,
    winEnd: null,
  };
}

function seenKey(scope: MetrcScope): string {
  return `${scope.license.toUpperCase()}|${scope.kind}|${scope.phase ?? ""}`;
}

function scopeKey(scope: MetrcScope): string {
  return `${scope.license.toUpperCase()}|${scope.endpoint}`;
}

function setOf(map: Map<string, Set<string>>, key: string): Set<string> {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  return set;
}

/** The rows of one page in the export's shape, by kind; the harvests'
 * finished-days scope is applied by the reconcile (a row the mirror holds
 * still takes its state). */
function shapeRows(scope: MetrcScope, rows: unknown[], tally: ScopeTally, state?: HarvestState): object[] {
  const out: object[] = [];
  if (scope.kind === "plants") {
    for (const row of rows) {
      const shaped = plantApiRow(row, scope.phase);
      if (!shaped) continue;
      const named = plantGrowthPhase(row);
      if (named && scope.phase && named !== scope.phase) tally.phaseMismatch += 1;
      out.push(shaped);
    }
  } else if (scope.kind === "packages") {
    for (const row of rows) {
      const shaped = packageApiRow(row);
      if (shaped) out.push(shaped);
    }
  } else {
    const listState = state ?? harvestStateOf(scope.endpoint);
    for (const row of rows) {
      const shaped = shapeHarvestRow(row, listState);
      if (shaped) out.push(shaped);
    }
  }
  return out;
}

function mountFilename(scope: MetrcScope): string {
  if (scope.kind === "plants") return scope.phase === "vegetative" ? PLANTS_VEGETATIVE : PLANTS_FLOWERING;
  if (scope.kind === "harvests") return HARVESTS_MOUNT_NAME;
  return PACKAGES_ACTIVE;
}

/** A30: one API mount per license, kind and phase per UTC day, reused by every
 * tick that day; its insert logs once, at creation. */
async function ensureMount(tick: Tick, scope: MetrcScope): Promise<MountState> {
  const key = seenKey(scope);
  const cached = tick.mounts.get(key);
  if (cached) return cached;
  const day = tick.at.slice(0, 10);
  const from = `${day}T00:00:00.000Z`;
  const to = new Date(Date.parse(from) + 86_400_000).toISOString();
  const row = await tick.db
    .prepare(
      `SELECT id, rows_total, rows_added, rows_updated, rows_unchanged, rows_gone FROM metrc_mounts
       WHERE source = 'api' AND license_value = ? AND kind = ? AND COALESCE(phase, '') = ? AND deleted_at IS NULL
         AND created_at >= ? AND created_at < ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(scope.license, scope.kind, scope.phase ?? "", from, to)
    .first<{ id: string; rows_total: number; rows_added: number; rows_updated: number; rows_unchanged: number; rows_gone: number }>();
  tick.budget.spendD1(1);
  let state: MountState;
  if (row) {
    state = {
      id: String(row.id),
      counts: { added: Number(row.rows_added), updated: Number(row.rows_updated), unchanged: Number(row.rows_unchanged), gone: Number(row.rows_gone) },
      rowsTotal: Number(row.rows_total),
      lead: [],
    };
  } else {
    const id = crypto.randomUUID();
    state = {
      id,
      counts: { added: 0, updated: 0, unchanged: 0, gone: 0 },
      rowsTotal: 0,
      lead: mountRowStmts(tick.db, {
        mountId: id,
        kind: scope.kind,
        phase: scope.phase,
        license: scope.license,
        source: "api",
        filename: mountFilename(scope),
        fileFormat: "json",
        rowsTotal: 0,
        actorId: null,
        reason: SYSTEM_REASON.metrc_sweep,
        summary: { api: true, host: tick.host, day },
        ts: tick.at,
      }),
    };
  }
  tick.mounts.set(key, state);
  return state;
}

/** Write one plan behind the day's mount (write mode only). */
async function writePlan(tick: Tick, scope: MetrcScope, plan: MirrorPlan<object>, done: boolean): Promise<void> {
  const mount = await ensureMount(tick, scope);
  const ts = tick.now();
  const rows = plan.add.length + plan.update.length + plan.unchanged;
  const counts = await writeMirrorPass(tick.db, {
    plan,
    mountId: mount.id,
    actorId: null,
    reason: SYSTEM_REASON.metrc_sweep,
    lead: mount.lead,
    before: mount.counts,
    rowsTotal: mount.rowsTotal + rows,
    done,
    summary: { api: true, host: tick.host, endpoint: scope.endpoint, last_tick_at: ts, complete: done },
    ts,
  });
  tick.budget.spendD1(1 + Math.ceil((plan.add.length / 3 + plan.update.length + plan.gone.length / 98 + mount.lead.length + 5) / 400));
  mount.lead = [];
  mount.counts = counts;
  mount.rowsTotal += rows;
}

/** One page's rows (or the onhold rows) through the one reconcile, complete
 * null: adds and updates only, counted into the run; written in write mode. */
async function reconcileRows(tick: Tick, scope: MetrcScope, tally: ScopeTally, rows: object[]): Promise<void> {
  const seen = setOf(tick.seen, seenKey(scope));
  const handled = setOf(tick.handled, scopeKey(scope));
  const fresh: object[] = [];
  for (const row of rows) {
    const key = mirrorKeyOf(scope.kind, row);
    seen.add(key);
    if (handled.has(key)) continue;
    handled.add(key);
    fresh.push(row);
  }
  if (fresh.length === 0) return;
  const existing = await loadExistingByKeys(tick.db, scope.kind, fresh.map((row) => mirrorKeyOf(scope.kind, row)));
  tick.budget.spendD1(Math.ceil(fresh.length / 99));
  let incoming = fresh;
  if (scope.kind === "harvests") {
    // Law 5: inactive harvests outside the finished-days scope are not
    // inserted; a harvest the mirror already holds still takes its state.
    const known = new Set(existing.map((row) => row.key));
    incoming = fresh.filter((row) => {
      const harvest = row as MetrcHarvestRow;
      if (harvestInScope(harvest, tick.at, tick.config.harvestFinishedDays) || known.has(String(harvest.harvest_id))) return true;
      tally.outOfScope += 1;
      return false;
    });
  }
  const plan = planMirrorPass<object>({
    scope: { kind: scope.kind, license: scope.license, phase: scope.phase },
    incoming,
    existing,
    complete: null,
    sampleCap: Math.max(0, tick.config.sampleCap - tally.samples.length),
  });
  tally.add += plan.add.length;
  tally.update += plan.update.length;
  tally.unchanged += plan.unchanged;
  tally.labStateChanged += plan.labStateChanged;
  if (tick.mode === "dry_run") tally.samples.push(...plan.samples);
  if (tick.mode === "write") await writePlan(tick, scope, plan, false);
}

type OnholdRead = { complete: boolean; keys: string[]; rows: object[]; message: string | null };

/** A10: the kind's onhold list, paged within the tick's budget. Plants count
 * within the phase their GrowthPhase names; harvests come back as rows with
 * state onhold; packages count by label. */
async function readOnhold(tick: Tick, scope: MetrcScope, tally: ScopeTally): Promise<OnholdRead> {
  const out: OnholdRead = { complete: false, keys: [], rows: [], message: null };
  const budget = tick.budget.forLicense(scope.license);
  const record = recorder(tick.db, budget, tick.host);
  const pageSize = clampPageSize(tick.config.pageSize);
  const userKey = userKeyFor(tick.env, scope.license) ?? "";
  for (let page = 1; page <= METRC_PAGE_CEILING; page += 1) {
    if (budget.exhausted()) {
      out.message = `The tick's budget ran out (${budget.stop() ?? "calls"}) inside the onhold list.`;
      return out;
    }
    const res = await readMetrcPage({
      env: tick.env,
      path: ONHOLD_ENDPOINTS[scope.kind],
      query: { licenseNumber: scope.license },
      page,
      pageSize,
      userKey,
      fetchImpl: tick.fetchImpl,
      sleep: tick.sleep,
      now: tick.now,
      clock: tick.clock,
      record,
    });
    if (res.kind !== "ok") {
      out.message = res.message;
      return out;
    }
    tally.pages += 1;
    tally.rows += res.rows.length;
    budget.spendRows(res.rows.length);
    if (scope.kind === "plants") {
      for (const row of res.rows) {
        const shaped = plantApiRow(row, scope.phase);
        if (!shaped) continue;
        if (plantGrowthPhase(row) === scope.phase) out.keys.push(shaped.tag);
      }
    } else if (scope.kind === "packages") {
      for (const row of res.rows) {
        const shaped = packageApiRow(row);
        if (shaped) out.keys.push(shaped.tag);
      }
    } else {
      for (const row of res.rows) {
        const shaped = shapeHarvestRow(row, "onhold");
        if (!shaped) continue;
        out.keys.push(String(shaped.harvest_id));
        out.rows.push(shaped);
      }
    }
    if (seriesDone(res, pageSize)) {
      out.complete = true;
      return out;
    }
  }
  out.message = "The onhold list reached the page ceiling.";
  return out;
}

/** The complete full pass's gone marks (A10, A19, A29), after the onhold
 * read. A throw keeps the pass open at its last page (the pager's rule), so
 * nothing is marked until a tick can read the onhold list whole. */
async function completePass(tick: Tick, scope: MetrcScope, tally: ScopeTally, pass: FullPassDone): Promise<void> {
  if (scope.kind === "harvests" && scope.endpoint === HARVESTS_INACTIVE) {
    // The inactive list's pass refreshes states and the mark; it never marks gone.
    tally.complete = true;
    return;
  }
  const onhold = await readOnhold(tick, scope, tally);
  if (!onhold.complete) throw new Error(`${ONHOLD_INCOMPLETE_WORDS} ${onhold.message ?? ""}`.trim());
  if (onhold.rows.length > 0) await reconcileRows(tick, scope, tally, onhold.rows);
  // The pass pages keep the keys as Metrc sent them; the mirror's tags are
  // upper-cased (shapePlantRow, shapePackageRow), so the seen set is too (a
  // harvest id is digits, unchanged).
  const seen = new Set<string>();
  for (const key of pass.seenTags) seen.add(key.toUpperCase());
  for (const key of setOf(tick.seen, seenKey(scope))) seen.add(key);
  for (const key of onhold.keys) seen.add(key);
  const live = await loadLiveKeys(tick.db, scope.kind, scope.license, scope.phase);
  tick.budget.spendD1(1);
  const plan = planMirrorPass<object>({
    scope: { kind: scope.kind, license: scope.license, phase: scope.phase },
    incoming: [],
    existing: [],
    live,
    // A29's "the pass read 0 rows" is the full pass's own count across its
    // ticks (the cursor's tally), never the tick's seen set, which the onhold
    // list or an incremental of the same tick can fill while the pass itself
    // answered nothing.
    complete: { seen, rowsRead: pass.cursor.full_rows_seen },
    passStartedAt: pass.passStartedAt,
    sampleCap: Math.max(0, tick.config.sampleCap - tally.samples.length),
    goneHoldShare: tick.config.goneHoldShare,
    goneOverride: pass.cursor.gone_override === 1,
  });
  tally.wouldGone = plan.wouldGone;
  tally.goneHeld = plan.goneHeld;
  tally.gone = plan.gone.length;
  if (tick.mode === "dry_run") tally.samples.push(...plan.samples);
  if (tick.mode === "write") await writePlan(tick, scope, plan, true);
  if (plan.overrideUsed) {
    // The override is consumed by this complete pass of its own cursor (the
    // mode's cursor, A26) whether or not the guard would have held, so it
    // never waits for a later empty read.
    await tick.db.prepare(`UPDATE metrc_cursors SET gone_override = 0, updated_at = ? WHERE id = ?`).bind(tick.now(), pass.cursor.id).run();
    tick.budget.spendD1(1);
  }
  tally.complete = true;
}

function pagerDeps(tick: Tick, scope: MetrcScope, tally: ScopeTally): PagerDeps {
  return {
    db: tick.db,
    env: tick.env,
    budget: tick.budget,
    config: tick.config,
    now: tick.now,
    clock: tick.clock,
    fetchImpl: tick.fetchImpl,
    sleep: tick.sleep,
    onPage: async (rows: unknown[], ctx: PageContext) => {
      if (ctx.totalRecords != null) tally.totalRecords = ctx.totalRecords;
      await reconcileRows(tick, scope, tally, shapeRows(scope, rows, tally));
    },
    onComplete: async (pass: FullPassDone) => {
      await completePass(tick, scope, tally, pass);
    },
  };
}

function scrubbed(tick: Tick, err: unknown): string {
  const integrator = (tick.env.METRC_INTEGRATOR_KEY ?? "").trim();
  const user = (tick.env.METRC_USER_KEY ?? "").trim();
  const text = err instanceof Error ? err.message : String(err);
  return scrubKeys(text, [integrator, user, basicToken(integrator, user)]) || "The mirror sweep failed.";
}

async function insertRun(db: D1Database, row: SweepRunRow, at: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO metrc_sweep_runs (
        id, host, license_value, endpoint, kind, phase, mode, run_kind, trigger, started_at, finished_at,
        win_start, win_end, pages, rows, total_records, calls, failures, would_add, would_update, would_gone, gone_held,
        status, message, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, NULL)`
    )
    .bind(
      row.id,
      row.host,
      row.license_value,
      row.endpoint,
      row.kind,
      row.phase,
      row.mode,
      row.run_kind,
      row.trigger,
      row.started_at,
      row.finished_at,
      row.win_start,
      row.win_end,
      row.pages,
      row.rows,
      row.total_records,
      row.calls,
      row.failures,
      row.would_add,
      row.would_update,
      row.would_gone,
      row.gone_held,
      row.status,
      row.message,
      at,
      at
    )
    .run();
}

/** Law 7: the dry run's sample differences, up to the cap, 14 rows a statement. */
async function insertSamples(db: D1Database, runId: string, samples: readonly MirrorSample[], at: string): Promise<void> {
  const cols = ["id", "run_id", "tag", "column_name", "mirror_value", "api_value", "created_at"];
  const per = Math.max(1, Math.floor(100 / cols.length));
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0; i < samples.length; i += per) {
    const chunk = samples.slice(i, i + per);
    const marks = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
    const values: unknown[] = [];
    for (const s of chunk) values.push(crypto.randomUUID(), runId, s.key, s.column, s.mirrorValue, s.apiValue, at);
    stmts.push(db.prepare(`INSERT INTO metrc_sweep_samples (${cols.join(", ")}) VALUES ${marks}`).bind(...values));
  }
  if (stmts.length > 0) await db.batch(stmts);
}

/** The tick's own row: off, keys absent, a refused write, or a failure. */
async function tickRow(db: D1Database, host: string, mode: string, trigger: MetrcTrigger, started: string, finished: string, status: string, message: string | null): Promise<void> {
  await insertRun(
    db,
    {
      id: crypto.randomUUID(),
      host,
      license_value: TICK_LICENSE,
      endpoint: TICK_ENDPOINT,
      kind: "sweep",
      phase: null,
      mode,
      run_kind: "tick",
      trigger,
      started_at: started,
      finished_at: finished,
      win_start: null,
      win_end: null,
      pages: null,
      rows: null,
      total_records: null,
      calls: null,
      failures: null,
      would_add: null,
      would_update: null,
      would_gone: null,
      gone_held: 0,
      status,
      message,
    },
    finished
  );
}

/** One scope's run (incremental or full): the pager reads, the reconcile
 * plans each page, the follow-ups land, and one run row records it all. */
async function sweepScope(tick: Tick, scope: MetrcScope, runKind: "incremental" | "full"): Promise<void> {
  const tally = newTally();
  const started = tick.now();
  const calls0 = tick.budget.calls;
  let status: ScopeStatus | "failed" = "ok";
  let message: string | null = null;
  let failures = 0;
  try {
    if (runKind === "incremental") {
      const result = await runIncremental(scope, pagerDeps(tick, scope, tally));
      status = result.status;
      message = result.message;
      tally.pages += result.pages;
      tally.rows += result.rows;
      tally.winStart = result.cursor?.win_start ?? null;
      tally.winEnd = result.cursor?.hwm_end ?? null;
    } else {
      const result = await runFullPass(scope, pagerDeps(tick, scope, tally));
      tally.pages += result.pages;
      tally.rows += result.rows;
      if (result.complete) {
        status = "ok";
        tally.totalRecords = result.totalRecords;
      } else {
        status = result.status;
        message = result.message;
        tally.totalRecords = result.cursor?.full_total_records ?? tally.totalRecords;
      }
    }
    if (status === "failed" || status === "refused" || status === "rate_limited" || status === "host_refused") failures = 1;
    if (scope.kind === "packages" && tick.mode === "write") {
      const mount = tick.mounts.get(seenKey(scope));
      if (mount && (tally.labStateChanged > 0 || (tally.complete && !tally.goneHeld))) {
        await afterPackagesPass(tick.db, null, mount.id, tick.now(), { complete: tally.complete, goneHeld: tally.goneHeld, labStateChanged: tally.labStateChanged });
        tick.budget.spendD1(3);
      }
    }
  } catch (err) {
    status = "failed";
    failures = 1;
    message = scrubbed(tick, err);
  }
  const notes: string[] = [];
  if (message) notes.push(message);
  if (tally.goneHeld) notes.push(GONE_HELD_WORDS);
  if (tally.phaseMismatch > 0) notes.push(`${tally.phaseMismatch} rows named another GrowthPhase than the list's.`);
  if (tally.outOfScope > 0) notes.push(`${tally.outOfScope} inactive harvests outside the ${tick.config.harvestFinishedDays}-day scope were not written.`);
  const finished = tick.now();
  const runId = crypto.randomUUID();
  try {
    await insertRun(
      tick.db,
      {
        id: runId,
        host: tick.host,
        license_value: scope.license,
        endpoint: scope.endpoint,
        kind: scope.kind,
        phase: scope.phase,
        mode: tick.mode,
        run_kind: runKind,
        trigger: tick.trigger,
        started_at: started,
        finished_at: finished,
        win_start: tally.winStart,
        win_end: tally.winEnd,
        pages: tally.pages,
        rows: tally.rows,
        total_records: tally.totalRecords,
        calls: tick.budget.calls - calls0,
        failures,
        would_add: tally.add,
        would_update: tally.update,
        would_gone: tally.complete ? tally.wouldGone : 0,
        gone_held: tally.goneHeld ? 1 : 0,
        status,
        message: notes.length > 0 ? notes.join(" ") : null,
      },
      finished
    );
    tick.budget.spendD1(1);
    if (tick.mode === "dry_run" && tally.samples.length > 0) {
      await insertSamples(tick.db, runId, tally.samples.slice(0, tick.config.sampleCap), finished);
      tick.budget.spendD1(1);
    }
    tick.runs += 1;
  } catch {
    // The run row is the log; a log that cannot be written must not fail the tick.
  }
}

// ---------------------------------------------------------------- retention

/** A30: prune the call, sweep and run logs (samples with their runs) older
 * than keepDays (never under METRC_LOG_KEEP_FLOOR_DAYS: the month pace counts
 * this month's calls, A18), at most `page` rows per statement and
 * `maxStatements` statements per tick; what is left waits for the next tick. */
export async function pruneMetrcLogs(
  db: D1Database,
  keepDays: number,
  nowIsoValue: string,
  maxStatements = 10,
  page = 500
): Promise<{ statements: number; deleted: number }> {
  const cutoff = new Date(Date.parse(nowIsoValue) - Math.max(METRC_LOG_KEEP_FLOOR_DAYS, keepDays) * 86_400_000).toISOString();
  let statements = 0;
  let deleted = 0;
  const step = async (sql: string): Promise<number> => {
    const out = await db.prepare(sql).bind(cutoff, page).run();
    statements += 1;
    const n = Number(out.meta?.changes ?? 0);
    deleted += n;
    return n;
  };
  const pages = [
    `DELETE FROM metrc_sweep_samples WHERE id IN (
       SELECT s.id FROM metrc_sweep_samples s JOIN metrc_sweep_runs r ON r.id = s.run_id WHERE r.started_at < ? ORDER BY s.id LIMIT ?)`,
    `DELETE FROM metrc_sweep_runs WHERE id IN (SELECT id FROM metrc_sweep_runs WHERE started_at < ? ORDER BY started_at, id LIMIT ?)`,
    `DELETE FROM metrc_sweeps WHERE id IN (SELECT id FROM metrc_sweeps WHERE started_at < ? ORDER BY started_at, id LIMIT ?)`,
    `DELETE FROM metrc_api_calls WHERE id IN (SELECT id FROM metrc_api_calls WHERE started_at < ? ORDER BY started_at, id LIMIT ?)`,
  ];
  for (const sql of pages) {
    for (;;) {
      if (statements >= maxStatements) return { statements, deleted };
      const n = await step(sql);
      if (n < page) break;
    }
  }
  return { statements, deleted };
}

// ---------------------------------------------------------------- the sweep

/** The mirror sweep by API (Laws 5 and 7). Its own try/catch; never throws. */
export async function runMirrorSweep(env: MetrcEnv, trigger: MetrcTrigger, opts: MirrorSweepOpts = {}): Promise<MirrorSweepResult> {
  const now = opts.now ?? nowIso;
  const clock = opts.clock ?? Date.now;
  const started = now();
  const host = metrcHost(env);
  const result: MirrorSweepResult = { mode: "off", runs: 0, calls: 0, status: "ok", message: null };
  const prune = async (config: MetrcSweepConfig): Promise<void> => {
    if (opts.retention ?? trigger === "cron") await pruneMetrcLogs(env.DB, config.logKeepDays, now());
  };
  try {
    const config = await loadMetrcSweepConfig(env.DB);
    const resolved = resolveSweepMode(env, config.sweepMode);
    result.mode = resolved.mode;
    if (resolved.mode === "off") {
      const message = resolved.refusal ?? SWEEP_OFF_WORDS;
      await tickRow(env.DB, host, "off", trigger, started, now(), "skipped", message);
      result.status = "skipped";
      result.message = message;
      await prune(config);
      return result;
    }
    const keys = keysPresent(env);
    if (!keys.integrator || !keys.user) {
      const message = absentWords(keys);
      await tickRow(env.DB, host, resolved.mode, trigger, started, now(), "skipped", message);
      result.status = "skipped";
      result.message = message;
      await prune(config);
      return result;
    }
    // A write asked for on a sandbox host runs as a dry run; the tick's row says why.
    if (resolved.refusal) await tickRow(env.DB, host, resolved.mode, trigger, started, now(), "mode_refused", resolved.refusal);
    const licenses = (await lookupLicenses(env.DB)).filter(isKnownSiteLicense);
    const flags = await loadGrowFlags(env.DB, host);
    const unchecked: string[] = [];
    const grows = new Set<string>();
    for (const license of licenses) {
      const answer = growsPlants(license, flags);
      if (answer === "grow") grows.add(license);
      else if (answer === "unchecked") unchecked.push(license);
    }
    let scopes = mirrorScopes(host, resolved.mode, licenses, (license) => grows.has(license));
    if (opts.only) {
      const only = opts.only;
      scopes = scopes.filter((scope) => scope.license.toUpperCase() === only.license.trim().toUpperCase() && scope.endpoint === only.endpoint);
      if (scopes.length === 0) {
        await tickRow(env.DB, host, resolved.mode, trigger, started, now(), "skipped", ONLY_UNKNOWN_WORDS);
        result.status = "skipped";
        result.message = ONLY_UNKNOWN_WORDS;
        return result;
      }
    }
    const paced = await startTickBudget(env.DB, config, started, scopes.length, clock, host);
    // Sweep now's cap holds only as a finite number (NaN would disarm the tick's call cap: calls >= NaN is never true).
    const budget =
      opts.calls != null && Number.isFinite(opts.calls) ? MetrcBudget.start(tickLimits(config, Math.max(0, Math.min(paced.calls, Math.floor(opts.calls)))), clock) : paced.budget;
    const tick: Tick = {
      db: env.DB,
      env,
      host,
      mode: resolved.mode,
      config,
      budget,
      trigger,
      at: started,
      now,
      clock,
      fetchImpl: opts.fetchImpl,
      sleep: opts.sleep,
      seen: new Map(),
      handled: new Map(),
      mounts: new Map(),
      runs: 0,
    };
    if (!opts.only) {
      for (const license of unchecked) {
        await insertRun(
          env.DB,
          {
            id: crypto.randomUUID(),
            host,
            license_value: license,
            endpoint: "plants+harvests",
            kind: "plants",
            phase: null,
            mode: resolved.mode,
            run_kind: "tick",
            trigger,
            started_at: started,
            finished_at: now(),
            win_start: null,
            win_end: null,
            pages: 0,
            rows: 0,
            total_records: null,
            calls: 0,
            failures: 0,
            would_add: 0,
            would_update: 0,
            would_gone: 0,
            gone_held: 0,
            status: "skipped",
            message: FACILITIES_UNCHECKED_WORDS,
          },
          now()
        );
      }
    }
    // Incrementals first: every scope whose cursor carries a mark (A26).
    for (const scope of scopes) {
      if (budget.exhausted()) break;
      const cursor = await loadCursor(env.DB, scope);
      budget.spendD1(1);
      if (!cursor || !cursor.hwm_end) continue;
      await sweepScope(tick, scope, "incremental");
    }
    // Then the full passes due, packages and harvests before plants.
    for (const kind of FULL_PASS_ORDER) {
      for (const scope of scopes) {
        if (scope.kind !== kind) continue;
        if (budget.exhausted()) break;
        const cursor = await loadCursor(env.DB, scope);
        budget.spendD1(1);
        if (!needsFullPass(cursor, tick.at)) continue;
        await sweepScope(tick, scope, "full");
      }
    }
    result.runs = tick.runs;
    result.calls = budget.calls;
    await prune(config);
    return result;
  } catch (err) {
    const integrator = (env.METRC_INTEGRATOR_KEY ?? "").trim();
    const user = (env.METRC_USER_KEY ?? "").trim();
    const message = scrubKeys(err instanceof Error ? err.message : String(err), [integrator, user, basicToken(integrator, user)]) || "The mirror sweep failed.";
    result.status = "failed";
    result.message = message;
    try {
      await tickRow(env.DB, host, result.mode, trigger, started, now(), "failed", message);
    } catch {
      // Nothing else to do: the cron must not fail on a log that cannot be written.
    }
    return result;
  }
}
