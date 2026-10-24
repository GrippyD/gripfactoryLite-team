import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_REASON } from "../src/config";
import { DICT, t, tFill } from "../src/i18n";
import { app } from "../src/index";
import {
  METRC_FLASH_WORDS,
  METRC_HOST_KIND_WORDS,
  METRC_RUN_KIND_WORDS,
  METRC_STATUS_WORDS,
  basicToken,
  metrcApiPage,
  storedWords,
} from "../src/metrcapi";
import {
  CREW_MOVE_COLUMN,
  ageHours,
  confirmGoneAction,
  isCrewMove,
  loadMetrcAdminPage,
  loadParity,
  parityTotals,
  parityVerdict,
  resetCursorAction,
  sweepNowAction,
} from "../src/metrcadmin";
import {
  ABOVE_CAP_WORDS,
  CEILING_PASS_WORDS,
  CEILING_WINDOW_WORDS,
  HOST_MISMATCH_WORDS,
  NEEDS_FULL_WORDS,
  REFUSED_WORDS,
  SECOND_429_WORDS,
  SHORT_PASS_WORDS,
  SHORT_WINDOW_WORDS,
  WRITE_SCOPE_WORDS,
} from "../src/metrcpager";
import {
  FACILITIES_UNCHECKED_WORDS,
  GONE_HELD_WORDS,
  HARVESTS_ACTIVE,
  HARVESTS_INACTIVE,
  MIRROR_ENDPOINTS,
  ONHOLD_INCOMPLETE_WORDS,
  ONLY_UNKNOWN_WORDS,
  PACKAGES_ACTIVE,
  PLANTS_FLOWERING,
  PLANTS_VEGETATIVE,
  SWEEP_OFF_WORDS,
  runMirrorSweep,
} from "../src/metrcsweep";
import { formOf, migratedDb, seedMirror, type MigratedDb } from "./migrated";

afterEach(() => {
  vi.unstubAllGlobals();
});

const PROD = "https://api-mi.metrc.com";
const PROD_HOST = "api-mi.metrc.com";
const SANDBOX = "https://sandbox-api-mi.metrc.com";
const SANDBOX_HOST = "sandbox-api-mi.metrc.com";
const KEYS = { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_USER_KEY: "fake-user-key" };
const TOKEN = basicToken("fake-vendor-key", "fake-user-key");
const NOW = "2026-10-08T10:45:00.000Z";
const GROW = "AU-G-C-000832";
const PROCESSOR = "AU-P-000694";
const OTHER_LICENSE = "GR-C-001132";
const ALL_LICENSES = ["AU-G-C-000832", "AU-P-000694", "GR-C-001132", "AU-G-C-001397", "GR-C-001405", "AU-G-C-001509", "GR-C-002600"];
const PIN = { cookie: "gf_pin=21319" };

function envOf(m: MigratedDb, extra: Record<string, string> = {}): Env {
  return {
    DB: m.db,
    THEME: "grip",
    ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) },
    METRC_API_BASE: PROD,
    ...KEYS,
    ...extra,
  } as unknown as Env;
}

function setMode(m: MigratedDb, mode: string): void {
  m.run(`UPDATE app_config SET value = ? WHERE key = 'metrc_sweep_mode'`, mode);
}

function seedFacilities(m: MigratedDb, host: string, grow: Record<string, number | null>): void {
  for (const [license, flag] of Object.entries(grow)) {
    m.run(
      `INSERT INTO metrc_facilities (host, license_value, in_lookup, reached, can_grow_plants, can_record_processing_jobs, can_track_vegetative_plants, license_type, checked_at)
       VALUES (?, ?, 1, 1, ?, ?, ?, 'Adult-Use', ?)`,
      host,
      license,
      flag,
      flag === 1 ? 0 : 1,
      flag,
      "2026-10-08T09:00:00.000Z"
    );
  }
}

function seedGrowOnly(m: MigratedDb, host: string): void {
  const flags: Record<string, number> = {};
  for (const license of ALL_LICENSES) flags[license] = license === GROW ? 1 : 0;
  seedFacilities(m, host, flags);
}

type CursorSeed = {
  id: string;
  host?: string;
  license: string;
  endpoint: string;
  mode?: string;
  kind?: string;
  phase?: string | null;
  hwm_end?: string | null;
  full_pass_id?: string | null;
  full_page?: number;
  full_total_pages?: number | null;
  full_completed_at?: string | null;
  full_due_at?: string | null;
  gone_override?: number;
  last_status?: string | null;
  last_run_at?: string | null;
  failures?: number;
  deleted_at?: string | null;
};

function seedCursor(m: MigratedDb, c: CursorSeed): void {
  m.run(
    `INSERT INTO metrc_cursors (id, host, license_value, endpoint, mode, kind, phase, hwm_end, full_pass_id, full_started_at, full_page, full_total_pages,
       full_rows_seen, full_completed_at, full_due_at, gone_override, last_status, last_http, last_run_at, failures, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    c.id,
    c.host ?? PROD_HOST,
    c.license,
    c.endpoint,
    c.mode ?? "dry_run",
    c.kind ?? (c.endpoint.startsWith("/plants") ? "plants" : c.endpoint.startsWith("/harvests") ? "harvests" : "packages"),
    c.phase ?? null,
    c.hwm_end ?? null,
    c.full_pass_id ?? null,
    c.full_pass_id ? "2026-10-08T08:00:00Z" : null,
    c.full_page ?? 0,
    c.full_total_pages ?? null,
    c.full_completed_at ?? null,
    c.full_due_at ?? null,
    c.gone_override ?? 0,
    c.last_status ?? null,
    c.last_run_at ?? null,
    c.failures ?? 0,
    "2026-10-08T08:00:00.000Z",
    "2026-10-08T09:00:00.000Z",
    c.deleted_at ?? null
  );
}

type RunSeed = {
  id: string;
  host?: string;
  license: string;
  endpoint: string;
  kind?: string;
  phase?: string | null;
  mode?: string;
  run_kind?: string;
  started_at?: string;
  rows?: number | null;
  calls?: number | null;
  failures?: number | null;
  would_add?: number;
  would_update?: number;
  would_gone?: number;
  gone_held?: number;
  status?: string;
  message?: string | null;
};

function seedRun(m: MigratedDb, r: RunSeed): void {
  const started = r.started_at ?? "2026-10-08T09:45:00.000Z";
  m.run(
    `INSERT INTO metrc_sweep_runs (id, host, license_value, endpoint, kind, phase, mode, run_kind, trigger, started_at, finished_at, pages, rows, total_records,
       calls, failures, would_add, would_update, would_gone, gone_held, status, message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cron', ?, ?, 1, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.id,
    r.host ?? PROD_HOST,
    r.license,
    r.endpoint,
    r.kind ?? (r.endpoint.startsWith("/plants") ? "plants" : r.endpoint.startsWith("/harvests") ? "harvests" : "packages"),
    r.phase ?? null,
    r.mode ?? "dry_run",
    r.run_kind ?? "full",
    started,
    started,
    r.rows ?? 0,
    r.calls ?? 0,
    r.failures ?? 0,
    r.would_add ?? 0,
    r.would_update ?? 0,
    r.would_gone ?? 0,
    r.gone_held ?? 0,
    r.status ?? "ok",
    r.message ?? null,
    started,
    started
  );
}

function seedSample(m: MigratedDb, runId: string, tag: string, column: string, mirror: string | null, api: string | null): void {
  m.run(
    `INSERT INTO metrc_sweep_samples (id, run_id, tag, column_name, mirror_value, api_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    `${runId}-${tag}-${column}`,
    runId,
    tag,
    column,
    mirror,
    api,
    "2026-10-08T09:45:00.000Z"
  );
}

function seedMount(m: MigratedDb, id: string, license: string, kind: string, phase: string | null, createdAt: string, source = "file"): void {
  m.run(
    `INSERT INTO metrc_mounts (id, kind, phase, license_value, filename, file_format, rows_total, rows_added, rows_updated, rows_unchanged, rows_gone, summary, created_at, updated_at, source)
     VALUES (?, ?, ?, ?, 'x.csv', 'csv', 1, 1, 0, 0, 0, '{}', ?, ?, ?)`,
    id,
    kind,
    phase,
    license,
    createdAt,
    createdAt,
    source
  );
}

function seedCall(m: MigratedDb, host: string | null, startedAt: string): void {
  m.run(`INSERT INTO metrc_api_calls (id, started_at, path, status, ms, host) VALUES (?, ?, '/x', 200, 1, ?)`, crypto.randomUUID(), startedAt, host);
}

function seedLabSweep(m: MigratedDb, status: string, message: string | null): void {
  m.run(
    `INSERT INTO metrc_sweeps (id, started_at, finished_at, status, trigger, message, packages_seen, results_read, fields_written)
     VALUES ('lab-1', '2026-10-08T10:15:00.000Z', '2026-10-08T10:15:05.000Z', ?, 'cron', ?, 4, 1, 0)`,
    status,
    message
  );
}

/** A fake Metrc answering one envelope per path (TotalPages from the rows), or a Response. */
function fakeApi(routes: Record<string, unknown[] | ((page: number) => Response)>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    const route = routes[url.pathname];
    const page = Number(url.searchParams.get("pageNumber") ?? "1");
    if (typeof route === "function") return route(page);
    const rows = route ?? [];
    return new Response(JSON.stringify({ Data: rows, Page: page, TotalPages: 1, TotalRecords: rows.length }), { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function pkg(label: string): Record<string, unknown> {
  return {
    Label: label,
    LocationName: "Barn",
    Quantity: 1,
    UnitOfMeasureAbbreviation: "g",
    LabTestingState: "TestPassed",
    IsFinishedGood: false,
    IsOnHold: false,
    IsOnRecall: false,
    PackagedDate: "2026-09-15",
    Item: { Name: "WPR - Zebra Cake - PNN - O", ProductCategoryName: "Buds", StrainName: "Zebra Cake" },
    ProductLabel: { OriginalSourcePackageLabel: null },
  };
}

/** The whole page with every section populated: cursors, runs, a held pass, a lab sweep, calls on three hosts. */
async function seededPage(m: MigratedDb): Promise<void> {
  setMode(m, "dry_run");
  seedGrowOnly(m, PROD_HOST);
  seedCursor(m, {
    id: "c-proc",
    license: PROCESSOR,
    endpoint: PACKAGES_ACTIVE,
    hwm_end: "2026-10-08T09:00:00Z",
    full_completed_at: "2026-10-08T03:00:00Z",
    full_due_at: "2026-10-09T02:55:00Z",
    last_status: "ok",
    last_run_at: "2026-10-08T09:45:00.000Z",
  });
  seedCursor(m, { id: "c-veg", license: GROW, endpoint: PLANTS_VEGETATIVE, phase: "vegetative", full_pass_id: "pass-1", full_page: 3, full_total_pages: 10, last_status: "budget", failures: 0 });
  seedCursor(m, { id: "c-grow-pkg", license: GROW, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z", last_status: "ok" });
  seedCursor(m, { id: "c-grow-flo", license: GROW, endpoint: PLANTS_FLOWERING, phase: "flowering", hwm_end: "2026-10-08T09:00:00Z", last_status: "short", failures: 3, gone_override: 1 });
  // A sandbox cursor of the same scope never shows on the production page.
  seedCursor(m, { id: "c-sbx", host: SANDBOX_HOST, license: PROCESSOR, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-01-01T00:00:00Z", last_status: "failed" });
  seedRun(m, { id: "r-proc-old", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-08T03:00:00.000Z", rows: 500, calls: 11, status: "ok" });
  seedRun(m, { id: "r-proc", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", started_at: "2026-10-08T09:45:00.000Z", rows: 12, calls: 2, failures: 0, status: "ok" });
  seedRun(m, {
    id: "r-veg",
    license: GROW,
    endpoint: PLANTS_VEGETATIVE,
    phase: "vegetative",
    run_kind: "full",
    rows: 150,
    calls: 3,
    status: "budget",
    message: "The tick's budget ran out (calls), so the cursor was saved where it stands.",
  });
  seedRun(m, { id: "r-grow-pkg", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", rows: 40, calls: 2, would_gone: 7, gone_held: 1, status: "ok", message: GONE_HELD_WORDS });
  seedRun(m, { id: "r-grow-flo", license: GROW, endpoint: PLANTS_FLOWERING, phase: "flowering", run_kind: "incremental", rows: 0, calls: 1, failures: 1, would_gone: 2, gone_held: 1, status: "short", message: SHORT_WINDOW_WORDS });
  seedLabSweep(m, "ok", "Metrc refused one facility.");
  seedCall(m, PROD_HOST, "2026-10-01T00:00:00.000Z");
  seedCall(m, PROD_HOST, "2026-10-05T00:00:00.000Z");
  seedCall(m, PROD_HOST, "2026-10-08T10:00:00.000Z");
  seedCall(m, null, "2026-10-08T10:01:00.000Z");
  seedCall(m, SANDBOX_HOST, "2026-10-08T10:02:00.000Z");
  seedCall(m, SANDBOX_HOST, "2026-10-08T10:03:00.000Z");
  seedCall(m, PROD_HOST, "2026-09-30T23:59:00.000Z");
}

const TAG_RE = /<([a-z][a-z0-9]*)\b[^>]*>/g;

/** One table row of the per-endpoint table, bounded to its closing tag (no
 * regex: an endpoint may carry a + or a /). */
function rowFor(html: string, endpoint: string, license: string): string {
  const open = `<tr data-metrc-endpoint="${endpoint}" data-metrc-endpoint-license="${license}"`;
  const start = html.indexOf(open);
  expect(start, `${license} ${endpoint} row`).toBeGreaterThanOrEqual(0);
  const end = html.indexOf("</tr>", start);
  return html.slice(start, end + 5);
}

/** The title attribute of the first tag that starts with `open`. */
function titleOf(html: string, open: string): string {
  const start = html.indexOf(open);
  expect(start, open).toBeGreaterThanOrEqual(0);
  const hit = html.slice(start).match(/^<[^>]*? title="([^"]*)"/);
  expect(hit, `${open} title`).toBeTruthy();
  return hit ? hit[1].replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&") : "";
}

describe("MA1 Law 9: the page renders every section from the seeded rows", () => {
  it("shows the host and mode, the keys per license with their flags, the pace, every scope, the lab sweep and the write switch", async () => {
    const m = await migratedDb();
    await seededPage(m);
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    expect(data.mode).toEqual({ hostKind: "production", configured: "dry_run", resolved: "dry_run", refusal: null });
    expect(data.calls).toBe(4);
    expect(data.budget).toMatchObject({ monthCalls: 45000, remaining: 44996, tickCalls: 60, sweepNowCalls: 10 });
    expect(data.budget?.nextTickCalls).toBe(60);
    expect(data.endpoints?.length).toBe(11);
    expect(data.sweepLicenses).toEqual([...ALL_LICENSES].sort());
    expect(data.sweepEndpoints).toEqual([...MIRROR_ENDPOINTS]);
    const proc = data.endpoints?.find((row) => row.license === PROCESSOR && row.endpoint === PACKAGES_ACTIVE);
    expect(proc?.cursor?.id).toBe("c-proc");
    expect(proc?.run).toMatchObject({ id: "r-proc", run_kind: "incremental", rows: 12, calls: 2, status: "ok" });
    expect(proc?.heldGone).toBeNull();
    const grow = data.endpoints?.find((row) => row.license === GROW && row.endpoint === PACKAGES_ACTIVE);
    expect(grow?.heldGone).toBe(7);
    expect(data.licenses?.find((row) => row.license === GROW)).toMatchObject({ reach: "reached", keyPresent: true, flags: { canGrowPlants: 1, canRecordProcessingJobs: 0, canTrackVegetativePlants: 1 } });

    const html = metrcApiPage(data, "en", null, 0);
    expect(html).toContain('class="report-scroll"><table');
    expect(html).toContain('data-metrc-mode="dry_run" data-metrc-mode-configured="dry_run" data-metrc-host-kind="production"');
    expect(html).toContain(`data-metrc-base="${PROD_HOST}"`);
    expect(html).toContain("Base: api-mi.metrc.com (production)");
    expect(html).toContain("Configured mode: dry_run; resolved mode: dry_run.");
    expect(html).toContain('data-metrc-integrator="present"');
    expect(html).toContain('data-metrc-user="present"');
    expect(html).toContain(`data-metrc-license="${GROW}" data-metrc-reach="reached" data-metrc-key="present" data-metrc-flags="1,0,1"`);
    expect(html).toContain(`${GROW}: Reached by this key; key present; flags: CanGrowPlants 1, CanRecordProcessingJobs 0, CanTrackVegetativePlants 1`);
    expect(html).toContain('data-metrc-calls="4"');
    expect(html).toContain('data-metrc-month-ceiling="45000" data-metrc-remaining="44996" data-metrc-next-tick="60" data-metrc-sweep-now-calls="10"');
    expect(html).toContain("Month ceiling: 45000; remaining: 44996; next tick: 60 calls (");
    expect(html).toContain('data-metrc-endpoints="11"');
    expect(html).toContain(`<tr data-metrc-endpoint="${PACKAGES_ACTIVE}" data-metrc-endpoint-license="${PROCESSOR}" data-metrc-endpoint-status="ok" data-metrc-cursor="c-proc"`);
    expect(html).toContain('data-metrc-hwm="2026-10-08T09:00:00Z"');
    expect(html).toContain("completed ");
    expect(html).toContain("due ");
    expect(html).toContain("incremental run");
    expect(html).toContain(`<tr data-metrc-endpoint="${PLANTS_VEGETATIVE}" data-metrc-endpoint-license="${GROW}" data-metrc-endpoint-status="budget" data-metrc-cursor="c-veg"`);
    expect(html).toContain("page 3 of 10");
    // Ruling 2b: the status cell keeps its help (what a person does) and carries the stored sentence after it.
    const budgetTitle = titleOf(html, '<td data-metrc-status="budget"');
    expect(budgetTitle).toContain("The status of this scope's last run.");
    expect(budgetTitle).toContain("a person resets the cursor");
    expect(budgetTitle).toContain("The tick's budget ran out (calls), so the cursor was saved where it stands.");
    expect(html).toContain('data-metrc-gone-held="7"');
    expect(html).toContain("The next complete pass will mark 7 rows gone.");
    expect(html).toContain('data-metrc-confirm-gone="c-grow-pkg"');
    expect(html).toContain('data-metrc-gone-override="1"');
    expect(html).toContain("Confirmed: the next complete pass marks gone without the guard.");
    expect(html).toContain('data-metrc-reset-cursor="c-veg"');
    expect(html).toContain('data-metrc-endpoint="lab" data-metrc-endpoint-license="" data-metrc-endpoint-status="ok"');
    expect(html).toContain('data-metrc-sweep="ok"');
    expect(html).toContain("Last lab sweep: ");
    expect(html).toContain('data-metrc-write="off"');
    expect(html).toContain(`<option value="${HARVESTS_INACTIVE}"`);
    expect(html).toContain(`<option value="${OTHER_LICENSE}"`);
    expect(html).toContain("The sweep mode as configured (metrc_sweep_mode: off, dry_run or write)");
    expect(html).toContain("Admin\\Data Lookups\\People and System\\App config");
    expect(html).not.toContain("c-sbx");
    expect(html).not.toContain("r-proc-old");
    expect(html).not.toContain("fake-vendor-key");
    expect(html).not.toContain("fake-user-key");
    expect(html).not.toContain(TOKEN);
    // A row without a cursor or a run says so and offers no button.
    const flo = rowFor(html, HARVESTS_ACTIVE, GROW);
    expect(flo).toContain("no run yet");
    expect(flo).toContain("no cursor yet");
    expect(flo).not.toContain("<form");
  });

  it("counts calls this month for the current host only (rows without a host included)", async () => {
    const m = await migratedDb();
    await seededPage(m);
    expect((await loadMetrcAdminPage(envOf(m), NOW)).calls).toBe(4);
    expect((await loadMetrcAdminPage(envOf(m, { METRC_API_BASE: SANDBOX }), NOW)).calls).toBe(3);
  });

  it("shows the refusal when the configured and resolved modes differ, and lists the dry_run cursors when the mode is off", async () => {
    const m = await migratedDb();
    await seededPage(m);
    setMode(m, "write");
    const sandbox = await loadMetrcAdminPage(envOf(m, { METRC_API_BASE: SANDBOX }), NOW);
    expect(sandbox.mode).toMatchObject({ hostKind: "sandbox", configured: "write", resolved: "dry_run" });
    const html = metrcApiPage(sandbox, "es", null, 0);
    expect(html).toContain('data-metrc-mode="dry_run" data-metrc-mode-configured="write" data-metrc-host-kind="sandbox"');
    expect(html).toContain("El modo write se rechaza en un host de sandbox");
    expect(html).toContain('data-metrc-cursor="c-sbx"');
    setMode(m, "off");
    const off = await loadMetrcAdminPage(envOf(m), NOW);
    expect(off.mode).toMatchObject({ configured: "off", resolved: "off", refusal: null });
    expect(off.endpoints?.find((row) => row.cursor?.id === "c-proc")).toBeTruthy();
  });

  it("renders the page without the Phase D fields (the client's own loader) and with none of its sections empty of hooks", async () => {
    const m = await migratedDb();
    const html = metrcApiPage({ integrator: false, user: false, host: SANDBOX_HOST, calls: 0, sweep: null }, "en", "absent", 0);
    expect(html).toContain('data-metrc-mode=""');
    expect(html).toContain('data-metrc-endpoints="0"');
    expect(html).toContain("No endpoint runs yet.");
    expect(html).toContain('data-metrc-parity="none"');
    expect(html).toContain("No production dry run yet.");
    expect(html).toContain('data-metrc-sweep=""');
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
  });
});

describe("MA1 Law 9: the parity pane", () => {
  async function seedParity(m: MigratedDb): Promise<void> {
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    // The grow license: two clean production dry runs, plus noise that never counts:
    // a sandbox dry run, a production write run, an older production dry run.
    seedRun(m, { id: "p-grow-pkg", license: GROW, endpoint: PACKAGES_ACTIVE, would_add: 0, would_update: 0, would_gone: 0 });
    seedRun(m, { id: "p-grow-veg", license: GROW, endpoint: PLANTS_VEGETATIVE, phase: "vegetative", would_add: 0, would_update: 0, would_gone: 0 });
    seedRun(m, { id: "p-grow-sbx", host: SANDBOX_HOST, license: GROW, endpoint: PACKAGES_ACTIVE, would_add: 5, started_at: "2026-10-08T10:00:00.000Z" });
    seedSample(m, "p-grow-sbx", "1A4050300000000000000S01", "location", "Barn", "Field");
    seedRun(m, { id: "p-grow-write", license: GROW, endpoint: PACKAGES_ACTIVE, mode: "write", would_add: 9, started_at: "2026-10-08T10:10:00.000Z" });
    seedRun(m, { id: "p-grow-older", license: GROW, endpoint: PACKAGES_ACTIVE, would_add: 3, started_at: "2026-10-07T09:45:00.000Z" });
    seedSample(m, "p-grow-older", "1A4050300000000000000O01", "quantity", "1", "2");
    // The processor license differs: counts and two samples.
    seedRun(m, { id: "p-proc", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, would_add: 2, would_update: 1, would_gone: 3, gone_held: 1 });
    seedSample(m, "p-proc", "1A4050300000000000000P01", "quantity", "750.5", "700");
    seedSample(m, "p-proc", "1A4050300000000000000P02", "(added)", null, "WPR - Zebra Cake - PNN - O");
    // Mounts: the grow license's file mounts per kind (an API mount is never the CSV age).
    seedMount(m, "m-veg", GROW, "plants", "vegetative", "2026-10-08T05:45:00.000Z");
    seedMount(m, "m-veg-old", GROW, "plants", "vegetative", "2026-10-01T05:45:00.000Z");
    seedMount(m, "m-pkg", GROW, "packages", null, "2026-10-05T10:45:00.000Z");
    seedMount(m, "m-api", GROW, "packages", null, "2026-10-08T10:00:00.000Z", "api");
  }

  it("reads production dry runs only, flips the sentence with the numbers, and ages the latest CSV mount per kind", async () => {
    const m = await migratedDb();
    await seedParity(m);
    const parity = await loadParity(m.db, [GROW, PROCESSOR, OTHER_LICENSE], NOW);
    expect(parity.map((line) => [line.license, line.verdict])).toEqual([
      [GROW, "clean"],
      [PROCESSOR, "differs"],
      [OTHER_LICENSE, "none"],
    ]);
    expect(parity[0].runs.map((run) => run.endpoint).sort()).toEqual([PACKAGES_ACTIVE, PLANTS_VEGETATIVE].sort());
    expect(parity[0].samples).toEqual([]);
    expect(parity[0].mounts).toEqual([
      { kind: "packages", phase: null, created_at: "2026-10-05T10:45:00.000Z", ageHours: 72 },
      { kind: "plants", phase: "vegetative", created_at: "2026-10-08T05:45:00.000Z", ageHours: 5 },
    ]);
    expect(parity[1].totals).toEqual({ add: 2, update: 1, gone: 3, held: 1, samples: 2 });
    expect(parity[1].samples.map((s) => s.tag)).toEqual(["1A4050300000000000000P01", "1A4050300000000000000P02"]);
    expect(parity[2]).toMatchObject({ runs: [], samples: [], mounts: [], verdict: "none" });

    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(html).toContain('data-metrc-parity="differs"');
    expect(html).toContain(`data-metrc-parity-license="${GROW}" data-metrc-parity-verdict="clean"`);
    expect(html).toContain('data-metrc-parity-sentence="clean"');
    expect(html).toContain("Parity reads clean.");
    expect(html).toContain(`data-metrc-parity-license="${PROCESSOR}" data-metrc-parity-verdict="differs"`);
    expect(html).toContain("Parity differs: 2 would add, 1 would update, 3 would be gone (1 held), 2 samples.");
    expect(html).toContain(`data-metrc-parity-license="${OTHER_LICENSE}" data-metrc-parity-verdict="none"`);
    expect(html).toContain("No production dry run yet for this license.");
    expect(html).toContain('data-metrc-csv-mounts="2"');
    expect(html).toContain("Latest CSV mount: packages 3 days ago; plants vegetative 5 hours ago");
    expect(html).toContain('data-metrc-csv-mounts="0"');
    expect(html).toContain("No CSV mount yet.");
    expect(html).toContain('data-metrc-sample="1A4050300000000000000P01" data-metrc-sample-column="quantity" data-metrc-sample-crew="0"');
    expect(html).not.toContain("1A4050300000000000000S01");
    expect(html).not.toContain("1A4050300000000000000O01");

    // The numbers move the sentence: the processor run reads clean once its counts and samples are gone.
    m.run(`UPDATE metrc_sweep_runs SET would_add = 0, would_update = 0, would_gone = 0, gone_held = 0 WHERE id = 'p-proc'`);
    m.run(`DELETE FROM metrc_sweep_samples WHERE run_id = 'p-proc'`);
    const clean = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(clean).toContain('data-metrc-parity="clean"');
    expect(clean).toContain(`data-metrc-parity-license="${PROCESSOR}" data-metrc-parity-verdict="clean"`);
    // One sample alone makes it differ again, even with every count at 0.
    seedSample(m, "p-proc", "1A4050300000000000000P03", "location", "Barn", "Field");
    const differs = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(differs).toContain("Parity differs: 0 would add, 0 would update, 0 would be gone (0 held), 1 samples.");
  });

  it("never counts a sandbox host's runs as parity, whatever they say", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, SANDBOX_HOST);
    seedRun(m, { id: "s-1", host: SANDBOX_HOST, license: GROW, endpoint: PACKAGES_ACTIVE, would_add: 0, would_update: 0, would_gone: 0 });
    seedRun(m, { id: "s-2", host: "api-mi.metrc.com.example.com", license: GROW, endpoint: PACKAGES_ACTIVE, would_add: 0 });
    const parity = await loadParity(m.db, [GROW], NOW);
    expect(parity[0].verdict).toBe("none");
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m, { METRC_API_BASE: SANDBOX }), NOW), "en", null, 0);
    expect(html).toContain('data-metrc-parity="none"');
    expect(html).toContain("No production dry run yet for this license.");
    expect(html).not.toContain("Parity reads clean.");
  });

  it("labels a location difference a crew move when the tag changed after its mount, and nothing else", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedMount(m, "mnt-a", PROCESSOR, "packages", null, "2026-10-08T06:00:00.000Z");
    m.run(
      `INSERT INTO metrc_packages (tag, license_value, location, item, quantity, uom, mount_id, first_seen_at, changed_at)
       VALUES ('1A4050300000000000000C01', ?, 'Cryo 2', 'x', 1, 'g', 'mnt-a', '2026-10-01T00:00:00.000Z', '2026-10-08T07:00:00.000Z'),
              ('1A4050300000000000000C02', ?, 'Cryo 1', 'x', 1, 'g', 'mnt-a', '2026-10-01T00:00:00.000Z', '2026-10-08T05:00:00.000Z'),
              ('1A4050300000000000000C03', ?, 'Cryo 1', 'x', 1, 'g', 'mnt-a', '2026-10-01T00:00:00.000Z', '2026-10-08T07:00:00.000Z')`,
      PROCESSOR,
      PROCESSOR,
      PROCESSOR
    );
    seedRun(m, { id: "p-crew", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, would_update: 3 });
    seedSample(m, "p-crew", "1A4050300000000000000C01", "location", "Cryo 2", "Cryo 1");
    seedSample(m, "p-crew", "1A4050300000000000000C02", "location", "Cryo 1", "Cryo 2");
    seedSample(m, "p-crew", "1A4050300000000000000C03", "quantity", "1", "2");
    seedSample(m, "p-crew", "1A4050300000000000000C09", "location", null, "Cryo 1");
    const parity = await loadParity(m.db, [PROCESSOR], NOW);
    expect(parity[0].samples.map((s) => [s.tag, s.column, s.crewMove])).toEqual([
      ["1A4050300000000000000C01", "location", true],
      ["1A4050300000000000000C02", "location", false],
      ["1A4050300000000000000C03", "quantity", false],
      ["1A4050300000000000000C09", "location", false],
    ]);
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(html).toContain('data-metrc-sample="1A4050300000000000000C01" data-metrc-sample-column="location" data-metrc-sample-crew="1"');
    expect(html).toContain("location (crew move)");
    expect(html).toContain('data-metrc-sample="1A4050300000000000000C02" data-metrc-sample-column="location" data-metrc-sample-crew="0"');
    expect((html.match(/crew move\)/g) ?? []).length).toBe(1);
    expect(metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "es", null, 0)).toContain("location (movimiento de cuadrilla)");
  });

  it("holds the pure rules: crew move, totals, verdict, age", () => {
    expect(CREW_MOVE_COLUMN).toBe("location");
    expect(isCrewMove("location", "2026-10-08T07:00:00.000Z", "2026-10-08T06:00:00.000Z")).toBe(true);
    expect(isCrewMove("location", "2026-10-08T06:00:00.000Z", "2026-10-08T06:00:00.000Z")).toBe(false);
    expect(isCrewMove("location", null, "2026-10-08T06:00:00.000Z")).toBe(false);
    expect(isCrewMove("location", "2026-10-08T07:00:00.000Z", null)).toBe(false);
    expect(isCrewMove("sublocation", "2026-10-08T07:00:00.000Z", "2026-10-08T06:00:00.000Z")).toBe(false);
    expect(isCrewMove("location", "soon", "2026-10-08T06:00:00.000Z")).toBe(false);
    const runs = [
      { endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: NOW, would_add: 1, would_update: 0, would_gone: 2, gone_held: 1 },
      { endpoint: PLANTS_VEGETATIVE, run_kind: "incremental", started_at: NOW, would_add: 0, would_update: 3, would_gone: 0, gone_held: 0 },
    ];
    expect(parityTotals(runs, 4)).toEqual({ add: 1, update: 3, gone: 2, held: 1, samples: 4 });
    expect(parityVerdict([], parityTotals([], 0))).toBe("none");
    expect(parityVerdict(runs, parityTotals(runs, 0))).toBe("differs");
    const zero = runs.map((run) => ({ ...run, would_add: 0, would_update: 0, would_gone: 0, gone_held: 1 }));
    expect(parityVerdict(zero, parityTotals(zero, 0))).toBe("clean");
    expect(parityVerdict(zero, parityTotals(zero, 1))).toBe("differs");
    // Evidence needs a complete full pass: incrementals alone are no verdict.
    const incrementalOnly = zero.filter((run) => run.run_kind === "incremental");
    expect(parityVerdict(incrementalOnly, parityTotals(incrementalOnly, 0))).toBe("none");
    for (const only of [{ would_add: 1 }, { would_update: 1 }, { would_gone: 1 }]) {
      const one = [{ ...zero[0], gone_held: 0, ...only }];
      expect(parityVerdict(one, parityTotals(one, 0)), JSON.stringify(only)).toBe("differs");
    }
    expect(ageHours("2026-10-08T05:45:00.000Z", NOW)).toBe(5);
    expect(ageHours("2026-10-08T11:45:00.000Z", NOW)).toBe(0);
    expect(ageHours("nope", NOW)).toBe(0);
  });
});

describe("MA1 Law 9: Confirm gone and Reset cursor", () => {
  it("sets gone_override on the named cursor of this host and nothing else, logged with the actor", async () => {
    const m = await migratedDb();
    seedCursor(m, { id: "c-1", license: GROW, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z", last_status: "ok", failures: 2 });
    seedCursor(m, { id: "c-2", license: GROW, endpoint: PLANTS_VEGETATIVE, phase: "vegetative" });
    seedCursor(m, { id: "c-3", host: SANDBOX_HOST, license: GROW, endpoint: PACKAGES_ACTIVE });
    seedCursor(m, { id: "c-4", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, deleted_at: "2026-10-08T09:30:00.000Z" });
    // Every cursor's scope holds a complete pass, so only the host, the deletion and the id decide.
    for (const [id, license, endpoint, host] of [
      ["r-1", GROW, PACKAGES_ACTIVE, PROD_HOST],
      ["r-2", GROW, PLANTS_VEGETATIVE, PROD_HOST],
      ["r-3", GROW, PACKAGES_ACTIVE, SANDBOX_HOST],
      ["r-4", PROCESSOR, PACKAGES_ACTIVE, PROD_HOST],
    ] as const) {
      seedRun(m, { id, host, license, endpoint, run_kind: "full", would_gone: 3, gone_held: 1, status: "ok", message: GONE_HELD_WORDS });
    }
    const before = JSON.stringify(m.get(`SELECT hwm_end, last_status, failures, full_page, deleted_at FROM metrc_cursors WHERE id = 'c-1'`));
    expect(await confirmGoneAction(envOf(m), formOf({ cursor: "c-1", run: "r-1", person_id: "person-9" }), NOW)).toBe("gone_confirmed");
    expect(m.all(`SELECT id, gone_override FROM metrc_cursors ORDER BY id`)).toEqual([
      { id: "c-1", gone_override: 1 },
      { id: "c-2", gone_override: 0 },
      { id: "c-3", gone_override: 0 },
      { id: "c-4", gone_override: 0 },
    ]);
    expect(JSON.stringify(m.get(`SELECT hwm_end, last_status, failures, full_page, deleted_at FROM metrc_cursors WHERE id = 'c-1'`))).toBe(before);
    expect(m.get(`SELECT updated_at, updated_by FROM metrc_cursors WHERE id = 'c-1'`)).toEqual({ updated_at: NOW, updated_by: "person-9" });
    expect(m.all(`SELECT record_table, record_id, field, old_value, new_value, actor_person_id, reason FROM record_change_log`)).toEqual([
      { record_table: "metrc_cursors", record_id: "c-1", field: "gone_override", old_value: "0", new_value: "1", actor_person_id: "person-9", reason: SYSTEM_REASON.metrc_gone_confirmed },
    ]);
    // Another host's cursor, a deleted cursor, a missing id: nothing changes.
    expect(await confirmGoneAction(envOf(m), formOf({ cursor: "c-3", run: "r-3" }), NOW)).toBe("gone_unknown");
    expect(await confirmGoneAction(envOf(m), formOf({ cursor: "c-4", run: "r-4" }), NOW)).toBe("gone_unknown");
    expect(await confirmGoneAction(envOf(m), formOf({ cursor: "", run: "r-1" }), NOW)).toBe("gone_unknown");
    expect(await confirmGoneAction(envOf(m), formOf({}), NOW)).toBe("gone_unknown");
    expect(m.all(`SELECT id FROM metrc_cursors WHERE gone_override = 1`)).toEqual([{ id: "c-1" }]);
    expect(m.all(`SELECT * FROM record_change_log`)).toHaveLength(1);
    // A second confirm keeps it set and logs the old value as 1.
    expect(await confirmGoneAction(envOf(m), formOf({ cursor: "c-1", run: "r-1" }), NOW)).toBe("gone_confirmed");
    expect(m.all(`SELECT old_value FROM record_change_log ORDER BY changed_at, old_value`).map((row) => row.old_value)).toEqual(["0", "1"]);
  });

  it("soft-deletes the cursor with a logged reason, drops its pass pages, and the next tick starts a fresh full pass", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-stuck", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, full_pass_id: "pass-9", full_page: 4, full_total_pages: 9, last_status: "short", failures: 5 });
    seedCursor(m, { id: "c-other", license: GROW, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z" });
    m.run(`INSERT INTO metrc_pass_pages (pass_id, page, tags_json, created_at) VALUES ('pass-9', 1, '["A"]', ?), ('pass-9', 2, '["B"]', ?), ('pass-8', 1, '["C"]', ?)`, NOW, NOW, NOW);
    seedRun(m, { id: "r-stuck", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, status: "short", message: SHORT_PASS_WORDS });
    expect(await resetCursorAction(envOf(m), formOf({ cursor: "c-stuck", person_id: "person-9" }), NOW)).toBe("cursor_reset");
    expect(m.get(`SELECT deleted_at, deleted_by, updated_at, updated_by FROM metrc_cursors WHERE id = 'c-stuck'`)).toEqual({
      deleted_at: NOW,
      deleted_by: "person-9",
      updated_at: NOW,
      updated_by: "person-9",
    });
    expect(m.get(`SELECT deleted_at FROM metrc_cursors WHERE id = 'c-other'`)).toEqual({ deleted_at: null });
    expect(m.all(`SELECT pass_id, page FROM metrc_pass_pages ORDER BY pass_id, page`)).toEqual([{ pass_id: "pass-8", page: 1 }]);
    expect(m.all(`SELECT record_table, record_id, field, old_value, new_value, actor_person_id, reason FROM record_change_log`)).toEqual([
      { record_table: "metrc_cursors", record_id: "c-stuck", field: "deleted_at", old_value: null, new_value: NOW, actor_person_id: "person-9", reason: SYSTEM_REASON.metrc_cursor_reset },
    ]);
    expect(m.all(`SELECT id FROM metrc_sweep_runs`)).toEqual([{ id: "r-stuck" }]);
    // The reset cursor is gone from the page; the scope reads "no cursor yet".
    const page = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(page).not.toContain("c-stuck");
    // The next tick (Sweep now here) makes a fresh cursor and a complete full pass from page 1.
    const api = fakeApi({ [PACKAGES_ACTIVE]: [pkg("1A4050300000000000000N01")] });
    const out = await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE }), { fetchImpl: api.fetchImpl, now: () => NOW });
    expect(out).toEqual({ code: "swept", calls: 2, runs: 1 });
    const fresh = m.get(`SELECT id, full_pass_id, full_page, full_completed_at, last_status, failures FROM metrc_cursors WHERE deleted_at IS NULL AND license_value = ? AND endpoint = ?`, PROCESSOR, PACKAGES_ACTIVE);
    expect(fresh?.id).not.toBe("c-stuck");
    expect(fresh).toMatchObject({ full_pass_id: null, full_page: 0, last_status: "ok", failures: 0 });
    expect(fresh?.full_completed_at).toBeTruthy();
    expect(api.calls).toEqual([PACKAGES_ACTIVE, "/packages/v2/onhold"]);
    // An unknown, deleted or other-host id changes nothing.
    expect(await resetCursorAction(envOf(m), formOf({ cursor: "c-stuck" }), NOW)).toBe("cursor_unknown");
    expect(await resetCursorAction(envOf(m, { METRC_API_BASE: SANDBOX }), formOf({ cursor: "c-other" }), NOW)).toBe("cursor_unknown");
    expect(await resetCursorAction(envOf(m), formOf({}), NOW)).toBe("cursor_unknown");
    expect(m.get(`SELECT deleted_at FROM metrc_cursors WHERE id = 'c-other'`)).toEqual({ deleted_at: null });
  });
});

describe("MA1 Law 9 and A20: Sweep now", () => {
  it("refuses in plain words with no call when a key is absent, the host is not a Metrc host, the mode is off, or the scope is unknown", async () => {
    const m = await migratedDb();
    seedGrowOnly(m, PROD_HOST);
    const fetchSpy = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const form = () => formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE });
    setMode(m, "dry_run");
    expect(await sweepNowAction({ DB: m.db, METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_API_BASE: PROD }, form())).toEqual({ code: "sweep_absent", calls: 0, runs: 0 });
    expect(await sweepNowAction({ DB: m.db, METRC_USER_KEY: "fake-user-key", METRC_API_BASE: PROD }, form())).toEqual({ code: "sweep_absent", calls: 0, runs: 0 });
    expect(await sweepNowAction(envOf(m, { METRC_API_BASE: "https://example.com" }), form())).toEqual({ code: "sweep_host", calls: 0, runs: 0 });
    setMode(m, "off");
    expect(await sweepNowAction(envOf(m), form())).toEqual({ code: "sweep_off", calls: 0, runs: 0 });
    setMode(m, "nonsense");
    expect(await sweepNowAction(envOf(m), form())).toEqual({ code: "sweep_off", calls: 0, runs: 0 });
    setMode(m, "dry_run");
    expect(await sweepNowAction(envOf(m), formOf({ license: "NOT-A-LICENSE", endpoint: PACKAGES_ACTIVE }))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    expect(await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: "/packages/v2/inactive" }))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    expect(await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: "//evil.example/x" }))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    expect(await sweepNowAction(envOf(m), formOf({}))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    // A grow-only endpoint on a packages-only license is one the sweep does not read.
    expect(await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: PLANTS_VEGETATIVE }))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
    expect(m.all(`SELECT status, license_value FROM metrc_sweep_runs WHERE license_value <> '*'`)).toHaveLength(0);
  });

  it("runs one scope inline as a dry run, bounded by metrc_sweep_now_calls, and writes a run row and nothing to the mirror", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedMirror(m, { tag: "1A4050300000000000000M01", license: PROCESSOR });
    m.run(`UPDATE app_config SET value = '2' WHERE key = 'metrc_sweep_now_calls'`);
    const mirrorBefore = JSON.stringify(m.all(`SELECT * FROM metrc_packages ORDER BY tag`));
    // Five pages of packages: the cap of 2 calls stops the full pass after page 2.
    const rows = Array.from({ length: 5 }, (_, i) => pkg(`1A405030000000000000A0${i}`));
    const api = fakeApi({
      [PACKAGES_ACTIVE]: (page) => new Response(JSON.stringify({ Data: [rows[page - 1]], Page: page, TotalPages: 5, TotalRecords: 5 }), { status: 200 }),
    });
    const out = await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE }), { fetchImpl: api.fetchImpl, now: () => NOW });
    expect(out).toEqual({ code: "swept", calls: 2, runs: 1 });
    expect(api.calls).toEqual([PACKAGES_ACTIVE, PACKAGES_ACTIVE]);
    const runs = m.all(`SELECT license_value, endpoint, mode, run_kind, trigger, pages, rows, calls, would_add, status FROM metrc_sweep_runs`);
    expect(runs).toEqual([
      { license_value: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "dry_run", run_kind: "full", trigger: "admin", pages: 2, rows: 2, calls: 2, would_add: 2, status: "budget" },
    ]);
    expect(m.all(`SELECT host FROM metrc_api_calls`)).toEqual([{ host: PROD_HOST }, { host: PROD_HOST }]);
    expect(JSON.stringify(m.all(`SELECT * FROM metrc_packages ORDER BY tag`))).toBe(mirrorBefore);
    expect(m.all(`SELECT * FROM metrc_mounts WHERE source = 'api'`)).toHaveLength(0);
    expect(m.get(`SELECT full_page, last_status FROM metrc_cursors WHERE deleted_at IS NULL`)).toEqual({ full_page: 3, last_status: "budget" });
    // The page shows the run and the cursor where it stands.
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", "swept", out.calls);
    expect(html).toContain('data-metrc-flash="swept"');
    expect(html).toContain("Sweep now ran: 2 calls.");
    expect(html).toContain("page 3 of 5");
    expect(html).toContain('data-metrc-endpoint-status="budget"');
  });

  it("on a sandbox host runs as a dry run too, never a write, whatever the mode says", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, SANDBOX_HOST);
    const api = fakeApi({ [PACKAGES_ACTIVE]: [pkg("1A4050300000000000000S01")] });
    const out = await sweepNowAction(envOf(m, { METRC_API_BASE: SANDBOX }), formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE }), { fetchImpl: api.fetchImpl, now: () => NOW });
    expect(out.code).toBe("swept");
    expect(m.all(`SELECT mode, status FROM metrc_sweep_runs ORDER BY started_at, license_value`)).toEqual([
      { mode: "dry_run", status: "mode_refused" },
      { mode: "dry_run", status: "ok" },
    ]);
    expect(m.all(`SELECT * FROM metrc_packages`)).toHaveLength(0);
    expect(m.all(`SELECT * FROM metrc_mounts`)).toHaveLength(0);
  });
});

describe("MA1 Law 9: the routes behind the Admin PIN", () => {
  it("serves the page, Sweep now, Confirm gone and Reset cursor as 303s with their words, and never a key", async () => {
    const m = await migratedDb();
    await seededPage(m);
    const env = envOf(m);
    expect((await app.request("/admin/metrc-api", {}, env)).status).toBe(401);
    const page = await app.request("/admin/metrc-api", { headers: PIN }, env);
    expect(page.status).toBe(200);
    const body = await page.text();
    expect(body).toContain('data-metrc-endpoints="11"');
    expect(body).toContain('data-metrc-mode="dry_run"');
    // The seeded production dry runs are parity evidence: the grow license's held gone marks make it differ.
    expect(body).toContain('data-metrc-parity="differs"');
    expect(body).toContain(`data-metrc-parity-license="${GROW}" data-metrc-parity-verdict="differs"`);
    expect(body).toContain(`data-metrc-parity-license="${PROCESSOR}" data-metrc-parity-verdict="clean"`);
    expect(body).not.toContain("fake-vendor-key");
    expect(body).not.toContain("fake-user-key");
    expect(body).not.toContain(TOKEN);

    setMode(m, "off");
    const off = await app.request("/admin/metrc-api/sweep-now", { method: "POST", headers: PIN, body: formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE }) }, env);
    expect(off.status).toBe(303);
    expect(off.headers.get("location")).toBe("/admin/metrc-api?ok=sweep_off&n=0");
    expect(await (await app.request("/admin/metrc-api?ok=sweep_off&n=0", { headers: PIN }, env)).text()).toContain('data-metrc-flash="sweep_off"');

    setMode(m, "dry_run");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ Data: [pkg("1A4050300000000000000R01")], Page: 1, TotalPages: 1, TotalRecords: 1 }), { status: 200 })));
    const swept = await app.request("/admin/metrc-api/sweep-now", { method: "POST", headers: PIN, body: formOf({ license: OTHER_LICENSE, endpoint: PACKAGES_ACTIVE }) }, env);
    expect(swept.status).toBe(303);
    expect(swept.headers.get("location")).toBe("/admin/metrc-api?ok=swept&n=2");
    const after = await (await app.request(swept.headers.get("location") ?? "", { headers: PIN }, env)).text();
    expect(after).toContain("Sweep now ran: 2 calls.");
    expect(after).toContain(`data-metrc-endpoint="${PACKAGES_ACTIVE}" data-metrc-endpoint-license="${OTHER_LICENSE}" data-metrc-endpoint-status="ok"`);
    expect(m.get(`SELECT trigger, run_kind FROM metrc_sweep_runs WHERE license_value = ?`, OTHER_LICENSE)).toEqual({ trigger: "admin", run_kind: "full" });

    const gone = await app.request("/admin/metrc-api/confirm-gone", { method: "POST", headers: PIN, body: formOf({ cursor: "c-grow-pkg", run: "r-grow-pkg" }) }, env);
    expect(gone.headers.get("location")).toBe("/admin/metrc-api?ok=gone_confirmed");
    const actor = m.get(`SELECT actor_person_id FROM record_change_log WHERE record_id = 'c-grow-pkg'`);
    expect(String(actor?.actor_person_id ?? "")).not.toBe("");
    expect(m.get(`SELECT gone_override FROM metrc_cursors WHERE id = 'c-grow-pkg'`)).toEqual({ gone_override: 1 });
    expect(await (await app.request("/admin/metrc-api?ok=gone_confirmed", { headers: PIN }, env)).text()).toContain("Gone confirmed: the next complete pass marks without the guard, once.");

    const reset = await app.request("/admin/metrc-api/reset-cursor", { method: "POST", headers: PIN, body: formOf({ cursor: "c-veg" }) }, env);
    expect(reset.headers.get("location")).toBe("/admin/metrc-api?ok=cursor_reset");
    expect(m.get(`SELECT deleted_at FROM metrc_cursors WHERE id = 'c-veg'`)?.deleted_at).toBeTruthy();
    const unknown = await app.request("/admin/metrc-api/reset-cursor", { method: "POST", headers: PIN, body: formOf({ cursor: "c-sbx" }) }, env);
    expect(unknown.headers.get("location")).toBe("/admin/metrc-api?ok=cursor_unknown");
    expect(await (await app.request("/admin/metrc-api?ok=cursor_unknown", { headers: PIN }, env)).text()).toContain("That cursor was not found on this host.");
    // A code from the query string never reads the prototype, and the page still answers 200.
    for (const code of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      const res = await app.request(`/admin/metrc-api?ok=${code}`, { headers: PIN }, env);
      expect(res.status, code).toBe(200);
      const odd = await res.text();
      expect(odd).not.toContain("data-metrc-flash");
      expect(odd).not.toContain("function ");
      expect(odd, code).toContain('data-metrc-endpoints="11"');
    }
    // A call count that is not a number reads 0.
    expect(await (await app.request("/admin/metrc-api?ok=swept&n=x", { headers: PIN }, env)).text()).toContain("Sweep now ran: 0 calls.");
  });
});

describe("MA1 Law 9: EN and ES, title help on every element, no key text", () => {
  it("renders every section in Spanish from the dictionary, with every status and run kind word translated", async () => {
    const m = await migratedDb();
    await seededPage(m);
    seedRun(m, { id: "p-es", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, would_add: 2, started_at: "2026-10-08T10:00:00.000Z" });
    seedSample(m, "p-es", "1A4050300000000000000E01", "location", "Barn", "Field");
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    const es = metrcApiPage(data, "es", "swept", 3);
    for (const word of [
      "Host y modo",
      "Modo configurado: dry_run; modo resuelto: dry_run.",
      "Claves",
      "clave presente",
      "banderas: CanGrowPlants 1",
      "Llamadas este mes",
      "Tope del mes: 45000",
      "Por endpoint",
      "corrida incremental",
      "pase completo",
      "presupuesto agotado",
      "barrido de laboratorio",
      "El proximo pase completo marcara 7 filas como idas.",
      "Confirmar idos",
      "Reiniciar cursor",
      "Barrer ahora",
      "Barrer ahora corrio: 3 llamadas.",
      "Paridad",
      "La paridad difiere: 2 por agregar, 0 por actualizar, 0 por marcar idos (0 retenidos), 1 muestras.",
      "Aun no hay prueba en seco de produccion para esta licencia.",
      "Aun no hay montaje CSV.",
      "Ultimo barrido de laboratorio",
      "El interruptor de escritura esta apagado.",
      "Admin\\Data Lookups\\People and System\\App config",
      "El presupuesto del tick se agoto (llamadas), asi que el cursor se guardo donde esta.",
      "Las marcas de idos se retuvieron (A29): el pase leyo muy pocas filas frente a las filas vivas. Confirme en la pagina de Admin para marcarlas.",
    ]) {
      expect(es, word).toContain(word);
    }
    for (const english of ["Host and mode", "Per endpoint", "Parity differs", "Sweep now ran", "Last lab sweep", "incremental run", "The next complete pass will mark"]) {
      expect(es, english).not.toContain(english);
    }
    expect(es).not.toContain("fake-vendor-key");
    expect(es).not.toContain("fake-user-key");
    expect(es).not.toContain(TOKEN);
  });

  it("gives every word table and every pager and sweep sentence a dictionary line with a non-empty Spanish", () => {
    const keys = [
      ...Object.values(METRC_STATUS_WORDS),
      ...Object.values(METRC_RUN_KIND_WORDS),
      ...Object.values(METRC_HOST_KIND_WORDS),
      ...Object.values(METRC_FLASH_WORDS).map((row) => row.key),
      NEEDS_FULL_WORDS,
      CEILING_WINDOW_WORDS,
      CEILING_PASS_WORDS,
      SHORT_PASS_WORDS,
      SHORT_WINDOW_WORDS,
      HOST_MISMATCH_WORDS,
      WRITE_SCOPE_WORDS,
      REFUSED_WORDS,
      SECOND_429_WORDS,
      ABOVE_CAP_WORDS,
      SWEEP_OFF_WORDS,
      FACILITIES_UNCHECKED_WORDS,
      ONHOLD_INCOMPLETE_WORDS,
      ONLY_UNKNOWN_WORDS,
      ...GONE_HELD_WORDS.split(/(?<=\.)\s+/),
      ...["calls", "license_calls", "rows", "d1", "wall"].flatMap((stop) => [
        `The tick's budget ran out (${stop}), so the cursor was saved where it stands.`,
        `The tick's budget ran out (${stop}) inside the onhold list.`,
      ]),
      "The onhold list reached the page ceiling.",
      "Metrc answered without a page.",
      "The page reader failed.",
      "The METRC cursor could not be read.",
      "The mirror sweep failed.",
    ];
    for (const key of keys) {
      const entry = DICT[key];
      expect(entry, key).toBeTruthy();
      expect(entry.en, key).toBe(key);
      expect(entry.es.trim(), key).not.toBe("");
    }
    expect(storedWords("es", `${SHORT_WINDOW_WORDS} ${GONE_HELD_WORDS}`)).not.toContain("TotalPages named");
    expect(t("es", "ok")).toBe("ok");
    expect(t("es", "budget")).toBe("presupuesto agotado");
  });

  it("holds a non-empty Spanish for every key of the Phase D dictionary block", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const text = fs.readFileSync(new URL("../src/i18n.ts", import.meta.url), "utf8");
    const start = text.indexOf("// MA1 Phase D, Law 9 (THE ADMIN SURFACE)");
    const end = text.indexOf("// MA1 Phase D end.");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = text.slice(start, end);
    const keys = [...block.matchAll(/^  "((?:[^"\\]|\\.)*)": \{/gm)].map((m) => m[1].replace(/\\\\/g, "\\").replace(/\\"/g, '"'));
    expect(keys.length).toBeGreaterThanOrEqual(120);
    for (const key of keys) {
      const entry = DICT[key];
      expect(entry, key).toBeTruthy();
      expect(entry.en, key).toBe(key);
      expect(entry.es.trim(), key).not.toBe("");
    }
  });

  it("gives every element of the page a native title, in both languages, with every branch rendered", async () => {
    const m = await migratedDb();
    await seededPage(m);
    seedRun(m, { id: "p-title", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, would_add: 1, started_at: "2026-10-08T10:00:00.000Z" });
    seedSample(m, "p-title", "1A4050300000000000000T01", "location", "Barn", "Field");
    seedMount(m, "m-title", PROCESSOR, "packages", null, "2026-10-08T05:45:00.000Z");
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    for (const locale of ["en", "es"] as const) {
      for (const ok of [null, "connected", "swept", "sweep_absent", "gone_confirmed"]) {
        const html = metrcApiPage(data, locale, ok, 3);
        const tags = html.match(TAG_RE) ?? [];
        expect(tags.length).toBeGreaterThan(200);
        for (const tag of tags) expect(tag, tag).toContain(' title="');
      }
    }
    const absent = metrcApiPage({ integrator: false, user: false, host: SANDBOX_HOST, calls: 0, sweep: null }, "en", "absent", 0);
    for (const tag of absent.match(TAG_RE) ?? []) expect(tag, tag).toContain(' title="');
  });
});

type PageData = Awaited<ReturnType<typeof loadMetrcAdminPage>>;

function scopeOf(data: PageData, license: string, endpoint: string) {
  return data.endpoints?.find((row) => row.license === license && row.endpoint === endpoint);
}

describe("MA1 Phase D fix pass: the hold, the parity evidence, the cursor's mode, the help and the words", () => {
  it("keeps the gone hold and its Confirm gone form through the incrementals that follow a held complete pass (A29)", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-grow-pkg", license: GROW, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:45:00Z", full_completed_at: "2026-10-08T09:45:00Z", last_status: "ok" });
    seedRun(m, { id: "r-held", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-08T09:45:00.000Z", rows: 40, calls: 2, would_gone: 7, gone_held: 1, status: "ok", message: GONE_HELD_WORDS });
    expect(scopeOf(await loadMetrcAdminPage(envOf(m), NOW), GROW, PACKAGES_ACTIVE)).toMatchObject({ heldGone: 7, heldRun: "r-held" });
    // The next tick's incremental is the latest run, but the hold is the complete pass's.
    seedRun(m, { id: "r-inc", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", started_at: "2026-10-08T10:45:00.000Z", rows: 0, calls: 1, status: "ok" });
    const after = await loadMetrcAdminPage(envOf(m), NOW);
    expect(scopeOf(after, GROW, PACKAGES_ACTIVE)?.run).toMatchObject({ id: "r-inc", run_kind: "incremental" });
    expect(scopeOf(after, GROW, PACKAGES_ACTIVE)).toMatchObject({ heldGone: 7, heldRun: "r-held" });
    const row = rowFor(metrcApiPage(after, "en", null, 0), PACKAGES_ACTIVE, GROW);
    expect(row).toContain("incremental run");
    expect(row).toContain('data-metrc-gone-held="7"');
    expect(row).toContain("The next complete pass will mark 7 rows gone.");
    expect(row).toContain('data-metrc-confirm-gone="c-grow-pkg"');
    expect(row).toContain('<input type="hidden" name="run" value="r-held"');
    // A later complete pass supersedes the hold: one that holds nothing clears it.
    seedRun(m, { id: "r-full-2", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-09T09:45:00.000Z", rows: 40, status: "ok" });
    const cleared = await loadMetrcAdminPage(envOf(m), NOW);
    expect(scopeOf(cleared, GROW, PACKAGES_ACTIVE)).toMatchObject({ heldGone: null, heldRun: null });
    const clearedRow = rowFor(metrcApiPage(cleared, "en", null, 0), PACKAGES_ACTIVE, GROW);
    expect(clearedRow).toContain('data-metrc-gone-held="0"');
    expect(clearedRow).not.toContain("confirm-gone");
    // A partial pass in progress after a new hold does not hide it, and the other mode's held pass is not this cursor's.
    seedRun(m, { id: "r-held-2", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-10T09:45:00.000Z", would_gone: 4, gone_held: 1, status: "ok", message: GONE_HELD_WORDS });
    seedRun(m, { id: "r-partial", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-10T10:45:00.000Z", status: "budget" });
    seedRun(m, { id: "r-write-held", license: GROW, endpoint: PACKAGES_ACTIVE, mode: "write", run_kind: "full", started_at: "2026-10-11T09:45:00.000Z", would_gone: 9, gone_held: 1, status: "ok" });
    const again = scopeOf(await loadMetrcAdminPage(envOf(m), NOW), GROW, PACKAGES_ACTIVE);
    expect(again?.run?.id).toBe("r-write-held");
    expect(again).toMatchObject({ heldGone: 4, heldRun: "r-held-2" });
  });

  it("pools the latest complete full pass and the latest complete incremental per scope as parity evidence, so an empty incremental never reads clean (Law 7)", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedRun(m, { id: "p-full", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-08T09:45:00.000Z", would_add: 2, would_update: 1, would_gone: 3, gone_held: 1, status: "ok" });
    seedSample(m, "p-full", "1A4050300000000000000F01", "quantity", "750.5", "700");
    expect((await loadParity(m.db, [PROCESSOR], NOW))[0]).toMatchObject({ verdict: "differs", totals: { add: 2, update: 1, gone: 3, held: 1, samples: 1 } });
    // The next tick's empty incremental adds nothing and hides nothing.
    seedRun(m, { id: "p-inc", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", started_at: "2026-10-08T10:45:00.000Z", status: "ok" });
    const second = await loadParity(m.db, [PROCESSOR], NOW);
    expect(second[0]).toMatchObject({ verdict: "differs", totals: { add: 2, update: 1, gone: 3, held: 1, samples: 1 } });
    expect(second[0].runs.map((run) => [run.endpoint, run.run_kind])).toEqual([
      [PACKAGES_ACTIVE, "full"],
      [PACKAGES_ACTIVE, "incremental"],
    ]);
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(html).toContain(`data-metrc-parity-license="${PROCESSOR}" data-metrc-parity-verdict="differs"`);
    expect(html).toContain("Parity differs: 2 would add, 1 would update, 3 would be gone (1 held), 1 samples.");
    expect(html).toContain(`data-metrc-parity-run="${PACKAGES_ACTIVE}" data-metrc-parity-run-kind="full"`);
    expect(html).toContain(`data-metrc-parity-run="${PACKAGES_ACTIVE}" data-metrc-parity-run-kind="incremental"`);
    expect(html).toContain("(full pass)");
    expect(html).toContain("(incremental run)");
    expect(html).not.toContain("Parity reads clean.");
    // A later incremental with a difference replaces the earlier incremental, and its sample counts.
    seedRun(m, { id: "p-inc-2", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", started_at: "2026-10-08T11:45:00.000Z", would_update: 1, status: "ok" });
    seedSample(m, "p-inc-2", "1A4050300000000000000F02", "location", "Barn", "Field");
    expect((await loadParity(m.db, [PROCESSOR], NOW))[0].totals).toEqual({ add: 2, update: 2, gone: 3, held: 1, samples: 2 });
    // A partial pass, a refused run and a failed run carry no evidence, however new.
    seedRun(m, { id: "p-budget", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-08T12:45:00.000Z", would_add: 9, status: "budget" });
    seedRun(m, { id: "p-refused", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", started_at: "2026-10-08T13:45:00.000Z", would_add: 5, status: "refused" });
    seedRun(m, { id: "p-failed", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-08T14:45:00.000Z", status: "failed" });
    const third = await loadParity(m.db, [PROCESSOR], NOW);
    expect(third[0].totals).toEqual({ add: 2, update: 2, gone: 3, held: 1, samples: 2 });
    expect(third[0].runs.map((run) => run.run_kind).sort()).toEqual(["full", "incremental"]);
    // Incrementals alone are no verdict: the comparison of the whole mirror is the full pass.
    seedRun(m, { id: "o-inc", license: OTHER_LICENSE, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", status: "ok" });
    const other = await loadParity(m.db, [OTHER_LICENSE], NOW);
    expect(other[0].verdict).toBe("none");
    expect(other[0].runs).toHaveLength(1);
    expect(metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0)).toContain(`data-metrc-parity-license="${OTHER_LICENSE}" data-metrc-parity-verdict="none"`);
    // A later complete pass that reads clean, with a clean incremental, is the one clean verdict.
    seedRun(m, { id: "p-full-clean", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-09T09:45:00.000Z", status: "ok" });
    seedRun(m, { id: "p-inc-clean", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", started_at: "2026-10-09T10:45:00.000Z", status: "ok" });
    expect((await loadParity(m.db, [PROCESSOR], NOW))[0]).toMatchObject({ verdict: "clean", totals: { add: 0, update: 0, gone: 0, held: 0, samples: 0 } });
  });

  it("breaks a started_at tie between one tick's incremental and full run toward the full pass", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-tie", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z" });
    seedRun(m, { id: "a-full", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", rows: 40, would_gone: 9, gone_held: 1, status: "ok" });
    seedRun(m, { id: "z-inc", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", rows: 2, status: "ok" });
    const tied = scopeOf(await loadMetrcAdminPage(envOf(m), NOW), PROCESSOR, PACKAGES_ACTIVE);
    expect(tied?.run?.id).toBe("a-full");
    expect(tied).toMatchObject({ heldGone: 9, heldRun: "a-full" });
    m.run(`DELETE FROM metrc_sweep_runs`);
    seedRun(m, { id: "z-full", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", rows: 40, status: "ok" });
    seedRun(m, { id: "a-inc", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", rows: 2, status: "ok" });
    expect(scopeOf(await loadMetrcAdminPage(envOf(m), NOW), PROCESSOR, PACKAGES_ACTIVE)?.run?.id).toBe("z-full");
  });

  it("shows and acts on the resolved mode's cursor only (A26): the other mode's cursor gets no button, no confirm and no reset", async () => {
    const m = await migratedDb();
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "k-w", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "write", hwm_end: "2026-10-08T09:00:00Z" });
    seedCursor(m, { id: "k-d", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "dry_run", hwm_end: "2026-10-08T09:00:00Z" });
    seedRun(m, { id: "r-w-held", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "write", run_kind: "full", would_gone: 3, gone_held: 1, status: "ok" });
    seedRun(m, { id: "r-d-held", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "dry_run", run_kind: "full", started_at: "2026-10-08T10:00:00.000Z", would_gone: 5, gone_held: 1, status: "ok" });
    const env = envOf(m);
    setMode(m, "write");
    const write = await loadMetrcAdminPage(env, NOW);
    expect(scopeOf(write, PROCESSOR, PACKAGES_ACTIVE)?.cursor).toMatchObject({ id: "k-w", mode: "write" });
    expect(scopeOf(write, PROCESSOR, PACKAGES_ACTIVE)).toMatchObject({ heldGone: 3, heldRun: "r-w-held" });
    const writeRow = rowFor(metrcApiPage(write, "en", null, 0), PACKAGES_ACTIVE, PROCESSOR);
    expect(writeRow).toContain('data-metrc-cursor="k-w" data-metrc-cursor-mode="write"');
    expect(writeRow).toContain('data-metrc-confirm-gone="k-w"');
    expect(writeRow).toContain('data-metrc-reset-cursor="k-w"');
    expect(writeRow).not.toContain("k-d");
    // The dry_run cursor is not this page's: both buttons refuse it, and nothing changes.
    expect(await confirmGoneAction(env, formOf({ cursor: "k-d", run: "r-d-held" }), NOW)).toBe("gone_unknown");
    expect(await resetCursorAction(env, formOf({ cursor: "k-d" }), NOW)).toBe("cursor_unknown");
    expect(m.get(`SELECT gone_override, deleted_at FROM metrc_cursors WHERE id = 'k-d'`)).toEqual({ gone_override: 0, deleted_at: null });
    expect(m.all(`SELECT * FROM record_change_log`)).toHaveLength(0);
    expect(await confirmGoneAction(env, formOf({ cursor: "k-w", run: "r-w-held" }), NOW)).toBe("gone_confirmed");
    expect(m.get(`SELECT gone_override FROM metrc_cursors WHERE id = 'k-w'`)).toEqual({ gone_override: 1 });
    // Under dry_run the page and the buttons turn to the dry_run cursor.
    setMode(m, "dry_run");
    const dry = await loadMetrcAdminPage(env, NOW);
    expect(scopeOf(dry, PROCESSOR, PACKAGES_ACTIVE)?.cursor).toMatchObject({ id: "k-d", mode: "dry_run" });
    expect(scopeOf(dry, PROCESSOR, PACKAGES_ACTIVE)).toMatchObject({ heldGone: 5, heldRun: "r-d-held" });
    expect(rowFor(metrcApiPage(dry, "en", null, 0), PACKAGES_ACTIVE, PROCESSOR)).toContain('data-metrc-cursor="k-d" data-metrc-cursor-mode="dry_run"');
    expect(await confirmGoneAction(env, formOf({ cursor: "k-w", run: "r-w-held" }), NOW)).toBe("gone_unknown");
    expect(await resetCursorAction(env, formOf({ cursor: "k-w" }), NOW)).toBe("cursor_unknown");
    expect(m.get(`SELECT deleted_at FROM metrc_cursors WHERE id = 'k-w'`)).toEqual({ deleted_at: null });
    // With only the other mode's cursor the scope reads no cursor yet and offers nothing.
    m.run(`UPDATE metrc_cursors SET deleted_at = ? WHERE id = 'k-d'`, NOW);
    const bare = await loadMetrcAdminPage(env, NOW);
    expect(scopeOf(bare, PROCESSOR, PACKAGES_ACTIVE)?.cursor).toBeNull();
    const bareRow = rowFor(metrcApiPage(bare, "en", null, 0), PACKAGES_ACTIVE, PROCESSOR);
    expect(bareRow).toContain("no cursor yet");
    expect(bareRow).not.toContain("<form");
    expect(bareRow).not.toContain("k-w");
    // The route answers the same word.
    const unknown = await app.request("/admin/metrc-api/confirm-gone", { method: "POST", headers: PIN, body: formOf({ cursor: "k-w", run: "r-w-held" }) }, env);
    expect(unknown.headers.get("location")).toBe("/admin/metrc-api?ok=gone_unknown");
  });

  it("refuses Confirm gone when the scope holds nothing, or when the named hold is not the current one", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-calm", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z" });
    seedRun(m, { id: "r-calm", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "full", status: "ok" });
    const env = envOf(m);
    expect(rowFor(metrcApiPage(await loadMetrcAdminPage(env, NOW), "en", null, 0), PACKAGES_ACTIVE, PROCESSOR)).not.toContain("confirm-gone");
    expect(await confirmGoneAction(env, formOf({ cursor: "c-calm", run: "r-calm" }), NOW)).toBe("gone_not_held");
    expect(await confirmGoneAction(env, formOf({ cursor: "c-calm" }), NOW)).toBe("gone_not_held");
    // A held scope: the form's run must be the current hold.
    seedCursor(m, { id: "c-held", license: GROW, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z" });
    seedRun(m, { id: "r-held", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", would_gone: 2, gone_held: 1, status: "ok" });
    expect(await confirmGoneAction(env, formOf({ cursor: "c-held" }), NOW)).toBe("gone_not_held");
    expect(await confirmGoneAction(env, formOf({ cursor: "c-held", run: "r-calm" }), NOW)).toBe("gone_not_held");
    expect(await confirmGoneAction(env, formOf({ cursor: "c-held", run: "r-held" }), NOW)).toBe("gone_confirmed");
    // A newer hold supersedes the old one: the old run id is a stale page.
    m.run(`UPDATE metrc_cursors SET gone_override = 0 WHERE id = 'c-held'`);
    seedRun(m, { id: "r-held-2", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-08T10:30:00.000Z", would_gone: 4, gone_held: 1, status: "ok" });
    expect(await confirmGoneAction(env, formOf({ cursor: "c-held", run: "r-held" }), NOW)).toBe("gone_not_held");
    expect(await confirmGoneAction(env, formOf({ cursor: "c-held", run: "r-held-2" }), NOW)).toBe("gone_confirmed");
    // A pass that completed since with nothing held: the old hold is gone.
    m.run(`UPDATE metrc_cursors SET gone_override = 0 WHERE id = 'c-held'`);
    seedRun(m, { id: "r-clear", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", started_at: "2026-10-08T11:30:00.000Z", status: "ok" });
    expect(await confirmGoneAction(env, formOf({ cursor: "c-held", run: "r-held-2" }), NOW)).toBe("gone_not_held");
    expect(m.get(`SELECT gone_override FROM metrc_cursors WHERE id = 'c-calm'`)).toEqual({ gone_override: 0 });
    expect(m.get(`SELECT gone_override FROM metrc_cursors WHERE id = 'c-held'`)).toEqual({ gone_override: 0 });
    expect(m.all(`SELECT record_id FROM record_change_log`)).toEqual([{ record_id: "c-held" }, { record_id: "c-held" }]);
    // The route and its words.
    const res = await app.request("/admin/metrc-api/confirm-gone", { method: "POST", headers: PIN, body: formOf({ cursor: "c-calm", run: "r-calm" }) }, env);
    expect(res.headers.get("location")).toBe("/admin/metrc-api?ok=gone_not_held");
    const page = await (await app.request("/admin/metrc-api?ok=gone_not_held", { headers: PIN }, env)).text();
    expect(page).toContain('data-metrc-flash="gone_not_held"');
    expect(page).toContain("Nothing is held for that cursor now; read the page again.");
  });

  it("escapes the lab sweep's packages_seen like every other stored value", async () => {
    const m = await migratedDb();
    seedGrowOnly(m, PROD_HOST);
    m.run(
      `INSERT INTO metrc_sweeps (id, started_at, finished_at, status, trigger, message, packages_seen, results_read, fields_written)
       VALUES ('lab-x', '2026-10-08T10:15:00.000Z', '2026-10-08T10:15:05.000Z', 'ok', 'cron', NULL, '<img src=x onerror=alert(1)>', 0, 0)`
    );
    for (const locale of ["en", "es"] as const) {
      const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), locale, null, 0);
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    }
  });

  it("reads own dictionary keys only: a prototype name renders as itself", () => {
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      expect(t("es", key), key).toBe(key);
      expect(t("en", key), key).toBe(key);
      expect(tFill("es", key, {}), key).toBe(key);
      expect(storedWords("es", key), key).toBe(key);
      expect(Object.prototype.hasOwnProperty.call(DICT, key), key).toBe(false);
    }
    expect(storedWords("es", "constructor. toString.")).toBe("constructor. toString.");
  });

  it("lists the sweep's own scopes: before Test connection a license's plants and harvests wait as one skipped line with the sweep's reason", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    m.run(`UPDATE app_config SET value = '5' WHERE key = 'metrc_month_calls'`);
    for (let i = 0; i < 4; i += 1) seedCall(m, PROD_HOST, `2026-10-0${i + 1}T00:00:00.000Z`);
    // No metrc_facilities row on this host: every license is unchecked.
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    expect(data.licenses?.every((row) => row.reach === "unchecked")).toBe(true);
    expect(data.endpoints?.length).toBe(14);
    expect(data.endpoints?.filter((row) => row.endpoint === PACKAGES_ACTIVE).length).toBe(7);
    const waiting = data.endpoints?.filter((row) => row.endpoint === "plants+harvests") ?? [];
    expect(waiting.map((row) => row.license)).toEqual([...ALL_LICENSES].sort());
    expect(waiting[0]).toMatchObject({ kind: "plants", cursor: null, run: null, note: FACILITIES_UNCHECKED_WORDS });
    expect(data.endpoints?.some((row) => row.endpoint === PLANTS_VEGETATIVE || row.endpoint === HARVESTS_ACTIVE)).toBe(false);
    // The pace counts the scopes the sweep will read, one call each at the floor.
    expect(data.budget).toMatchObject({ monthCalls: 5, remaining: 1, nextTickCalls: 7 });
    const html = metrcApiPage(data, "en", null, 0);
    expect(html).toContain('data-metrc-endpoints="14"');
    const line = rowFor(html, "plants+harvests", OTHER_LICENSE);
    expect(line).toContain('data-metrc-endpoint-status="skipped"');
    expect(line).toContain(">skipped</td>");
    expect(line).toContain("no run yet");
    expect(titleOf(line, '<td data-metrc-status="skipped"')).toContain(FACILITIES_UNCHECKED_WORDS);
    expect(line).not.toContain("<form");
    const es = rowFor(metrcApiPage(data, "es", null, 0), "plants+harvests", OTHER_LICENSE);
    expect(titleOf(es, '<td data-metrc-status="skipped"')).toContain(t("es", FACILITIES_UNCHECKED_WORDS));
    expect(es).toContain(`>${t("es", "skipped")}</td>`);
    // The tick's own skipped row then reads as that line's run.
    const api = fakeApi({});
    await runMirrorSweep(envOf(m), "cron", { fetchImpl: api.fetchImpl, now: () => NOW });
    const ticked = await loadMetrcAdminPage(envOf(m), NOW);
    expect(scopeOf(ticked, OTHER_LICENSE, "plants+harvests")?.run).toMatchObject({ run_kind: "tick", status: "skipped", message: FACILITIES_UNCHECKED_WORDS });
    const tickedLine = rowFor(metrcApiPage(ticked, "en", null, 0), "plants+harvests", OTHER_LICENSE);
    expect(tickedLine).toContain('data-metrc-endpoint-status="skipped"');
    expect(tickedLine).toContain(">tick</td>");
    expect(titleOf(tickedLine, '<td data-metrc-status="skipped"')).toContain(FACILITIES_UNCHECKED_WORDS);
    // One facilities row on this host checks every license: the lines are the sweep's 31 scopes.
    seedFacilities(m, PROD_HOST, { [OTHER_LICENSE]: 0 });
    const checked = await loadMetrcAdminPage(envOf(m), NOW);
    expect(checked.endpoints?.length).toBe(31);
    expect(checked.endpoints?.some((row) => row.endpoint === "plants+harvests")).toBe(false);
  });

  it("keeps the status help on every status cell and appends the stored sentence after it (ruling 2b), on the lab row too", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-short", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z", last_status: "short", failures: 3 });
    seedRun(m, { id: "r-short", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, run_kind: "incremental", status: "short", message: SHORT_WINDOW_WORDS });
    seedLabSweep(m, "failed", "Metrc answered 503.");
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    const en = metrcApiPage(data, "en", null, 0);
    const shortTitle = titleOf(rowFor(en, PACKAGES_ACTIVE, PROCESSOR), '<td data-metrc-status="short"');
    expect(shortTitle.indexOf("The status of this scope's last run.")).toBe(0);
    expect(shortTitle).toContain("a person resets the cursor");
    expect(shortTitle).toContain(SHORT_WINDOW_WORDS);
    const labTitle = titleOf(rowFor(en, "lab", ""), '<td data-metrc-status="failed"');
    expect(labTitle.indexOf("The hourly lab sweep")).toBe(0);
    expect(labTitle).toContain("Metrc answered 503.");
    const es = metrcApiPage(data, "es", null, 0);
    const shortEs = titleOf(rowFor(es, PACKAGES_ACTIVE, PROCESSOR), '<td data-metrc-status="short"');
    expect(shortEs).toContain("una persona reinicie el cursor");
    expect(shortEs).toContain(t("es", SHORT_WINDOW_WORDS));
    expect(shortEs).not.toContain("TotalPages named");
    const labEs = titleOf(rowFor(es, "lab", ""), '<td data-metrc-status="failed"');
    expect(labEs).toContain("El barrido de laboratorio de cada hora");
    expect(labEs).toContain("Metrc respondio 503.");
    expect(labEs).not.toContain("Metrc answered");
    // The lab sweep line below the table reads the same sentence in Spanish.
    expect(es).toContain("Metrc respondio 503.");
  });

  it("translates the sweep's counted sentences through their templates (EN and ES)", () => {
    const phase = "3 rows named another GrowthPhase than the list's.";
    const scope = "2 inactive harvests outside the 30-day scope were not written.";
    const answered = "Metrc answered 503.";
    expect(storedWords("es", phase)).toBe(tFill("es", "{n} rows named another GrowthPhase than the list's.", { n: "3" }));
    expect(storedWords("es", phase)).not.toContain("rows named");
    expect(storedWords("es", scope)).toBe(tFill("es", "{n} inactive harvests outside the {d}-day scope were not written.", { n: "2", d: "30" }));
    expect(storedWords("es", scope)).toContain("30");
    expect(storedWords("es", answered)).toBe("Metrc respondio 503.");
    const joined = storedWords("es", `${GONE_HELD_WORDS} ${phase} ${scope}`);
    expect(joined).toContain("Confirme en la pagina de Admin para marcarlas.");
    expect(joined).not.toContain("rows named");
    expect(joined).not.toContain("were not written");
    expect(storedWords("en", `${phase} ${scope} ${answered}`)).toBe(`${phase} ${scope} ${answered}`);
    // A sentence outside the templates and the dictionary stays as stored.
    expect(storedWords("es", "Something else happened.")).toBe("Something else happened.");
    expect(storedWords("es", "Metrc answered late.")).toBe("Metrc answered late.");
    for (const key of ["{n} rows named another GrowthPhase than the list's.", "{n} inactive harvests outside the {d}-day scope were not written.", "Metrc answered {s}."]) {
      const entry = DICT[key];
      expect(entry, key).toBeTruthy();
      expect(entry.es, key).not.toBe(entry.en);
      for (const hole of key.match(/\{[a-z]\}/g) ?? []) expect(entry.es, key).toContain(hole);
    }
  });

  it("names the CSV mount's kind and phase in the page's language", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedRun(m, { id: "p-m", license: GROW, endpoint: PACKAGES_ACTIVE, run_kind: "full", status: "ok" });
    seedMount(m, "m-h", GROW, "harvests", null, "2026-10-07T04:45:00.000Z");
    seedMount(m, "m-p", GROW, "packages", null, "2026-10-05T10:45:00.000Z");
    seedMount(m, "m-f", GROW, "plants", "flowering", "2026-10-08T03:45:00.000Z");
    seedMount(m, "m-v", GROW, "plants", "vegetative", "2026-10-08T05:45:00.000Z");
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    expect(metrcApiPage(data, "en", null, 0)).toContain("Latest CSV mount: harvests 30 hours ago; packages 3 days ago; plants flowering 7 hours ago; plants vegetative 5 hours ago");
    const es = metrcApiPage(data, "es", null, 0);
    expect(es).toContain("Ultimo montaje CSV: cosechas hace 30 horas; paquetes hace 3 dias; plantas floracion hace 7 horas; plantas vegetativo hace 5 horas");
    expect(es).not.toContain("packages hace");
    for (const key of ["harvests", "vegetative", "flowering", "plants", "packages"]) expect(DICT[key]?.es, key).not.toBe(key);
  });

  it("gives the Sweep now license choice the license lookup's path, and the key lines the page's own buttons", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    const en = metrcApiPage(data, "en", null, 0);
    const licenseSelect = titleOf(en, '<select name="license"');
    expect(licenseSelect).toContain("Admin\\Data Lookups\\Logistics\\Licenses");
    expect(licenseSelect).toContain("The license to sweep now");
    expect(titleOf(en, `<option value="${GROW}"`)).toBe(licenseSelect);
    expect(titleOf(en, '<select name="endpoint"')).toContain("Runs one license and endpoint of the mirror sweep now");
    for (const line of ['<p data-metrc-integrator="present"', '<p data-metrc-user="present"']) {
      const title = titleOf(en, line);
      expect(title).toContain("Test connection and Sweep now make no call");
      expect(title).not.toContain("the run button");
    }
    const es = metrcApiPage(data, "es", null, 0);
    expect(titleOf(es, '<select name="license"')).not.toBe(licenseSelect);
    expect(titleOf(es, '<select name="license"')).toContain("Admin\\Data Lookups\\Logistics\\Licenses");
    expect(titleOf(es, '<p data-metrc-user="present"')).not.toContain("Test connection and Sweep now make no call");
    expect(titleOf(es, '<p data-metrc-user="present"')).toContain("Probar conexion");
  });

  it("heads the calls section once: Calls over the Calls this month line", async () => {
    const m = await migratedDb();
    await seededPage(m);
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    const en = metrcApiPage(data, "en", null, 0);
    expect(en).toContain(">Calls</h2>");
    expect(en).toContain(">Calls this month: 4</p>");
    expect((en.match(/>Calls this month/g) ?? []).length).toBe(1);
    const es = metrcApiPage(data, "es", null, 0);
    expect(es).toContain(">Llamadas</h2>");
    expect(es).toContain(">Llamadas este mes: 4</p>");
    expect((es.match(/>Llamadas este mes/g) ?? []).length).toBe(1);
  });

  it("reads a call count that is not a whole number as 0 in the flash", () => {
    const data = { integrator: true, user: true, host: PROD_HOST, calls: 0, sweep: null };
    expect(metrcApiPage(data, "en", "swept", Number.NaN)).toContain("Sweep now ran: 0 calls.");
    expect(metrcApiPage(data, "en", "swept", Number.POSITIVE_INFINITY)).toContain("Sweep now ran: 0 calls.");
    expect(metrcApiPage(data, "en", "swept", -3)).toContain("Sweep now ran: 0 calls.");
    expect(metrcApiPage(data, "en", "swept", 2.7)).toContain("Sweep now ran: 2 calls.");
    expect(metrcApiPage(data, "en", "connected", 4)).toContain("Connected. 4 facilities.");
  });
});

function seedFacility(m: MigratedDb, host: string, license: string, reached: number, grow: number): void {
  m.run(
    `INSERT INTO metrc_facilities (host, license_value, in_lookup, reached, can_grow_plants, can_record_processing_jobs, can_track_vegetative_plants, license_type, checked_at)
     VALUES (?, ?, 1, ?, ?, ?, ?, 'Adult-Use', ?)`,
    host,
    license,
    reached,
    grow,
    grow === 1 ? 0 : 1,
    grow,
    "2026-10-08T09:00:00.000Z"
  );
}

function rowOf(html: string, endpoint: string, license: string): string {
  return rowFor(html, endpoint, license);
}

function unesc(s: string): string {
  return s.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");
}

describe("MA1 Phase D review: the mutants the suite let survive", () => {
  it("D02 D03: would-add alone and would-update alone each read differs on the page", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedRun(m, { id: "add-only", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, would_add: 1 });
    seedRun(m, { id: "update-only", license: OTHER_LICENSE, endpoint: PACKAGES_ACTIVE, would_update: 1 });
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(html).toContain(`data-metrc-parity-license="${PROCESSOR}" data-metrc-parity-verdict="differs"`);
    expect(html).toContain("Parity differs: 1 would add, 0 would update, 0 would be gone (0 held), 0 samples.");
    expect(html).toContain(`data-metrc-parity-license="${OTHER_LICENSE}" data-metrc-parity-verdict="differs"`);
    expect(html).toContain("Parity differs: 0 would add, 1 would update, 0 would be gone (0 held), 0 samples.");
  });

  it("D18 D26: over the ceiling the remaining budget reads 0 and the next tick keeps one call per scope", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    for (let i = 0; i < 4; i += 1) seedCall(m, PROD_HOST, `2026-10-0${i + 1}T00:00:00.000Z`);
    m.run(`UPDATE app_config SET value = '5' WHERE key = 'metrc_month_calls'`);
    const nearly = await loadMetrcAdminPage(envOf(m), NOW);
    expect(nearly.endpoints?.length).toBe(11);
    expect(nearly.budget).toMatchObject({ monthCalls: 5, remaining: 1, nextTickCalls: 11, tickCalls: 60 });
    m.run(`UPDATE app_config SET value = '3' WHERE key = 'metrc_month_calls'`);
    const over = await loadMetrcAdminPage(envOf(m), NOW);
    expect(over.budget).toMatchObject({ monthCalls: 3, remaining: 0, nextTickCalls: 11 });
    const html = metrcApiPage(over, "en", null, 0);
    expect(html).toContain('data-metrc-month-ceiling="3" data-metrc-remaining="0" data-metrc-next-tick="11"');
  });

  it("D21 D25: under write the page shows the scope's write cursor, under dry_run its dry_run cursor (A26)", async () => {
    const m = await migratedDb();
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-w", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "write", last_status: "ok" });
    seedCursor(m, { id: "c-d", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "dry_run", last_status: "ok" });
    m.run(`UPDATE metrc_cursors SET updated_at = '2026-10-08T10:00:00.000Z' WHERE id = 'c-d'`);
    setMode(m, "write");
    const write = await loadMetrcAdminPage(envOf(m), NOW);
    expect(write.mode).toMatchObject({ hostKind: "production", configured: "write", resolved: "write" });
    expect(scopeOf(write, PROCESSOR, PACKAGES_ACTIVE)?.cursor).toMatchObject({ id: "c-w", mode: "write" });
    expect(metrcApiPage(write, "en", null, 0)).toContain(`data-metrc-endpoint-license="${PROCESSOR}" data-metrc-endpoint-status="ok" data-metrc-cursor="c-w"`);
    setMode(m, "dry_run");
    const dry = await loadMetrcAdminPage(envOf(m), NOW);
    expect(scopeOf(dry, PROCESSOR, PACKAGES_ACTIVE)?.cursor).toMatchObject({ id: "c-d", mode: "dry_run" });
  });

  it("D23: a newer sandbox run never shows as the production scope's last run", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedRun(m, { id: "r-p", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, rows: 12, started_at: "2026-10-08T09:45:00.000Z" });
    seedRun(m, { id: "zz-s", host: SANDBOX_HOST, license: PROCESSOR, endpoint: PACKAGES_ACTIVE, rows: 99, started_at: "2026-10-08T10:00:00.000Z" });
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    expect(scopeOf(data, PROCESSOR, PACKAGES_ACTIVE)?.run).toMatchObject({ id: "r-p", rows: 12 });
    const row = rowOf(metrcApiPage(data, "en", null, 0), PACKAGES_ACTIVE, PROCESSOR);
    expect(row).toContain(">12</td>");
    expect(row).not.toContain(">99</td>");
  });

  it("D32: Sweep now never prunes the logs", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCall(m, PROD_HOST, "2025-01-01T00:00:00.000Z");
    seedRun(m, { id: "r-ancient", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, started_at: "2025-01-01T00:00:00.000Z" });
    m.run(
      `INSERT INTO metrc_sweeps (id, started_at, finished_at, status, trigger, message, packages_seen, results_read, fields_written) VALUES ('lab-ancient', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:05.000Z', 'ok', 'cron', NULL, 0, 0, 0)`
    );
    const api = fakeApi({ [PACKAGES_ACTIVE]: [pkg("1A4050300000000000000K01")] });
    const out = await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE }), { fetchImpl: api.fetchImpl, now: () => NOW });
    expect(out.code).toBe("swept");
    expect(m.all(`SELECT id FROM metrc_api_calls WHERE started_at < '2026'`)).toHaveLength(1);
    expect(m.all(`SELECT id FROM metrc_sweep_runs WHERE id = 'r-ancient'`)).toHaveLength(1);
    expect(m.all(`SELECT id FROM metrc_sweeps WHERE id = 'lab-ancient'`)).toHaveLength(1);
  });

  it("D33 D34: an unknown license or endpoint is refused before the sweep, with no run row at all", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    const fetchSpy = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await sweepNowAction(envOf(m), formOf({ license: "NOT-A-LICENSE", endpoint: PACKAGES_ACTIVE }))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    expect(await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: "/packages/v2/inactive" }))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    expect(await sweepNowAction(envOf(m), formOf({ license: PROCESSOR, endpoint: "//evil.example/x" }))).toEqual({ code: "sweep_unknown", calls: 0, runs: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(m.all(`SELECT * FROM metrc_sweep_runs`)).toHaveLength(0);
  });

  it("D35: a sweep that fails reads sweep_failed, with the failed tick row", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    const broken = new Proxy(m.db as unknown as Record<string, unknown>, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (sql.includes("FROM metrc_facilities")) throw new Error("the facilities read broke");
            return (target.prepare as (s: string) => unknown)(sql);
          };
        }
        return target[prop as string];
      },
    }) as unknown as D1Database;
    const out = await sweepNowAction({ DB: broken, ...KEYS, METRC_API_BASE: PROD }, formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE }), { now: () => NOW });
    expect(out).toEqual({ code: "sweep_failed", calls: 0, runs: 0 });
    expect(m.all(`SELECT license_value, status, message FROM metrc_sweep_runs`)).toEqual([{ license_value: "*", status: "failed", message: "the facilities read broke" }]);
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", "sweep_failed", 0);
    expect(html).toContain('data-metrc-flash="sweep_failed"');
    expect(html).toContain("Sweep now failed; the run row says why.");
  });

  it("D47: Reset cursor leaves the scope's other mode's cursor live (A26)", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedCursor(m, { id: "c-d", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "dry_run" });
    seedCursor(m, { id: "c-w", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "write" });
    expect(await resetCursorAction(envOf(m), formOf({ cursor: "c-d", person_id: "person-9" }), NOW)).toBe("cursor_reset");
    expect(m.all(`SELECT id, deleted_at FROM metrc_cursors ORDER BY id`)).toEqual([
      { id: "c-d", deleted_at: NOW },
      { id: "c-w", deleted_at: null },
    ]);
  });

  it("D58: with the user key absent every license reads key absent", async () => {
    const m = await migratedDb();
    seedGrowOnly(m, PROD_HOST);
    const data = await loadMetrcAdminPage(envOf(m, { METRC_USER_KEY: "" }), NOW);
    expect(data.user).toBe(false);
    expect((data.licenses ?? []).every((row) => row.keyPresent === false)).toBe(true);
    const html = metrcApiPage(data, "en", null, 0);
    expect(html).toContain('data-metrc-user="absent"');
    expect(html).toContain(`data-metrc-license="${GROW}" data-metrc-reach="reached" data-metrc-key="absent"`);
    expect(html).toContain(`${GROW}: Reached by this key; key absent;`);
    expect(html).not.toContain('data-metrc-key="present"');
  });

  it("D59: a not-reached license shows flags not checked, never its row's flags", async () => {
    const m = await migratedDb();
    seedFacility(m, PROD_HOST, PROCESSOR, 0, 1);
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    expect(data.licenses?.find((row) => row.license === PROCESSOR)).toMatchObject({ reach: "not_reached", flags: null });
    const html = metrcApiPage(data, "en", null, 0);
    expect(html).toContain(`data-metrc-license="${PROCESSOR}" data-metrc-reach="not_reached" data-metrc-key="present" title=`);
    expect(html).toContain(`${PROCESSOR}: Not reached by this key; key present; flags not checked`);
    expect(html).not.toContain(`data-metrc-license="${PROCESSOR}" data-metrc-reach="not_reached" data-metrc-key="present" data-metrc-flags=`);
  });

  it("D106: a reached facility row wins over a stale not-reached row in another letter case", async () => {
    const m = await migratedDb();
    seedFacility(m, PROD_HOST, PROCESSOR, 0, 0);
    seedFacility(m, PROD_HOST, PROCESSOR.toLowerCase(), 1, 1);
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    expect(data.licenses?.find((row) => row.license === PROCESSOR)).toMatchObject({ reach: "reached", flags: { canGrowPlants: 1 } });
  });

  it("D70 D93 D94 D95 D96: the Spanish page carries no English text node, heading, button or help title", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-es", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z" });
    seedRun(m, { id: "r-es", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, would_gone: 2, gone_held: 1, status: "ok" });
    const data = await loadMetrcAdminPage(envOf(m), NOW);
    const en = metrcApiPage(data, "en", "swept", 2);
    const es = metrcApiPage(data, "es", "swept", 2);
    // Text nodes: every heading, label and button of the page in Spanish, none left in English.
    for (const word of ["License", "Endpoint", "Last run", "Run kind", "Rows read", "Calls", "Failures", "Status", "High-water mark", "Full pass", "Gone held", "Actions", "Confirm gone", "Reset cursor", "Sweep now", "Keys", "Parity", "Host and mode", "Per endpoint"]) {
      const entry = DICT[word];
      expect(entry, word).toBeTruthy();
      expect(es, word).toContain(`>${t("es", word)}<`);
      if (entry.es !== entry.en) expect(es, word).not.toContain(`>${word}<`);
    }
    expect(es).toContain(">Llamadas este mes: ");
    expect(es).not.toContain(">Calls this month");
    // Help titles: every EN title that has a Spanish line reads Spanish on the Spanish page.
    const titles = [...en.matchAll(/ title="([^"]*)"/g)].map((hit) => hit[1]);
    expect(titles.length).toBeGreaterThan(50);
    let translated = 0;
    for (const raw of new Set(titles)) {
      const key = unesc(raw);
      const entry = DICT[key];
      if (!entry || entry.es === entry.en) continue;
      translated += 1;
      expect(es, key.slice(0, 60)).not.toContain(` title="${raw}"`);
    }
    expect(translated).toBeGreaterThan(15);
    expect(es).toContain('title="Borra en suave este cursor');
  });

  it("D95 D96: every key of the Phase D block has a Spanish that differs from the English, bar the four that read the same", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const text = fs.readFileSync(new URL("../src/i18n.ts", import.meta.url), "utf8");
    const block = text.slice(text.indexOf("// MA1 Phase D, Law 9 (THE ADMIN SURFACE)"), text.indexOf("// MA1 Phase D end."));
    const keys = [...block.matchAll(/^  "((?:[^"\\]|\\.)*)": \{/gm)].map((hit) => hit[1].replace(/\\\\/g, "\\").replace(/\\"/g, '"'));
    expect(keys.length).toBeGreaterThanOrEqual(120);
    const same = ["sandbox", "Endpoint", "tick", "ok"];
    for (const key of keys) {
      const entry = DICT[key];
      expect(entry, key).toBeTruthy();
      if (same.includes(key)) expect(entry.es, key).toBe(entry.en);
      else expect(entry.es, key).not.toBe(entry.en);
    }
  });

  it("D76 D77: a row without a hold reads No, and a row without a cursor offers no button", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-proc", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, hwm_end: "2026-10-08T09:00:00Z" });
    seedRun(m, { id: "r-proc", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, rows: 3 });
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    const proc = rowOf(html, PACKAGES_ACTIVE, PROCESSOR);
    expect(proc).toContain('<td data-metrc-gone-held="0"');
    expect(proc).toContain(">No</td>");
    expect(proc).not.toContain("confirm-gone");
    expect(proc).toContain('data-metrc-reset-cursor="c-proc"');
    expect(html).not.toContain("mark null rows");
    const bare = rowOf(html, HARVESTS_ACTIVE, GROW);
    expect(bare).toContain("no cursor yet");
    expect(bare).not.toContain("reset-cursor");
    expect(bare).not.toContain("confirm-gone");
    expect(bare).not.toContain("<form");
  });

  it("D78: the status cell shows the latest run's status, not the cursor's older last_status", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-x", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, last_status: "ok" });
    seedRun(m, { id: "r-x", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, status: "refused" });
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(html).toContain(`data-metrc-endpoint-license="${PROCESSOR}" data-metrc-endpoint-status="refused" data-metrc-cursor="c-x"`);
    expect(rowOf(html, PACKAGES_ACTIVE, PROCESSOR)).toContain('data-metrc-status="refused"');
  });

  it("D81: a failed lab sweep counts one failure in its row", async () => {
    const m = await migratedDb();
    seedGrowOnly(m, PROD_HOST);
    seedLabSweep(m, "failed", "Metrc answered 503.");
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    const lab = rowOf(html, "lab", "");
    expect(lab).toContain('data-metrc-endpoint-status="failed"');
    expect(lab).toContain(">1</td>");
    expect(lab).not.toContain(">0</td>");
  });

  it("D85: a mount between 24 and 47 hours old reads in hours", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedRun(m, { id: "r-age", license: PROCESSOR, endpoint: PACKAGES_ACTIVE });
    seedMount(m, "m-30h", PROCESSOR, "packages", null, "2026-10-07T04:45:00.000Z");
    const html = metrcApiPage(await loadMetrcAdminPage(envOf(m), NOW), "en", null, 0);
    expect(html).toContain("Latest CSV mount: packages 30 hours ago");
    expect(html).not.toContain("1 days ago");
  });

  it("D97: the reset-cursor route records the actor on the cursor and in the log", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-r", license: PROCESSOR, endpoint: PACKAGES_ACTIVE });
    const env = envOf(m);
    const reset = await app.request("/admin/metrc-api/reset-cursor", { method: "POST", headers: PIN, body: formOf({ cursor: "c-r" }) }, env);
    expect(reset.headers.get("location")).toBe("/admin/metrc-api?ok=cursor_reset");
    const row = m.get(`SELECT deleted_at, deleted_by, updated_by FROM metrc_cursors WHERE id = 'c-r'`);
    expect(String(row?.deleted_at ?? "")).not.toBe("");
    expect(String(row?.deleted_by ?? "")).not.toBe("");
    expect(row?.updated_by).toBe(row?.deleted_by);
    expect(String(m.get(`SELECT actor_person_id FROM record_change_log WHERE record_id = 'c-r'`)?.actor_person_id ?? "")).toBe(String(row?.deleted_by));
  });

  it("D100: 0097's name index carries no COLLATE (Postgres-portable, ruling 2b)", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(path: URL, encoding: "utf8"): string };
    const sql = fs.readFileSync(new URL("../migrations/0097_metrc_harvests.sql", import.meta.url), "utf8");
    expect(sql).toContain("CREATE INDEX metrc_harvests_name ON metrc_harvests (name);");
    expect(sql.toUpperCase()).not.toContain("COLLATE");
  });

  it("the three POSTs sit behind the PIN too", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, PROD_HOST);
    seedCursor(m, { id: "c-pin", license: PROCESSOR, endpoint: PACKAGES_ACTIVE });
    seedRun(m, { id: "r-pin", license: PROCESSOR, endpoint: PACKAGES_ACTIVE, would_gone: 2, gone_held: 1, status: "ok" });
    const env = envOf(m);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    for (const [path, body] of [
      ["/admin/metrc-api/sweep-now", formOf({ license: PROCESSOR, endpoint: PACKAGES_ACTIVE })],
      ["/admin/metrc-api/confirm-gone", formOf({ cursor: "c-pin", run: "r-pin" })],
      ["/admin/metrc-api/reset-cursor", formOf({ cursor: "c-pin" })],
    ] as const) {
      expect((await app.request(path, { method: "POST", body }, env)).status, path).toBe(401);
    }
    expect(m.all(`SELECT id FROM metrc_sweep_runs`)).toEqual([{ id: "r-pin" }]);
    expect(m.get(`SELECT gone_override, deleted_at FROM metrc_cursors WHERE id = 'c-pin'`)).toEqual({ gone_override: 0, deleted_at: null });
  });
});
