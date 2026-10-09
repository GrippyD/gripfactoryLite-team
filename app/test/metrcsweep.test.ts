import { describe, expect, it } from "vitest";
import { SYSTEM_REASON } from "../src/config";
import worker from "../src/index";
import { METRC_PACKAGE_COLUMNS, METRC_PLANT_COLUMNS, mountMetrcExport, planMirrorPass, type LiveRow, type MirrorExisting } from "../src/metrc";
import { SWEEP_WRITE_ON_SANDBOX, recordMetrcCall } from "../src/metrcapi";
import { callsThisMonth, loadCursor } from "../src/metrcpager";
import {
  FACILITIES_UNCHECKED_WORDS,
  GONE_HELD_WORDS,
  HARVESTS_ACTIVE,
  HARVESTS_INACTIVE,
  HARVESTS_MOUNT_NAME,
  METRC_LOG_KEEP_FLOOR_DAYS,
  MIRROR_CRON,
  ONHOLD_ENDPOINTS,
  ONHOLD_INCOMPLETE_WORDS,
  PACKAGES_ACTIVE,
  PLANTS_FLOWERING,
  PLANTS_VEGETATIVE,
  SWEEP_OFF_WORDS,
  growsPlants,
  isMirrorCron,
  mirrorScopes,
  pruneMetrcLogs,
  runMirrorSweep,
} from "../src/metrcsweep";
import { migratedDb, seedMirror, seedPerson, type MigratedDb } from "./migrated";

const PROD = "https://api-mi.metrc.com";
const PROD_HOST = "api-mi.metrc.com";
const SANDBOX = "https://sandbox-api-mi.metrc.com";
const SANDBOX_HOST = "sandbox-api-mi.metrc.com";
const KEYS = { METRC_INTEGRATOR_KEY: "fake-vendor-key", METRC_USER_KEY: "fake-user-key" };
const NOW = "2026-10-08T10:45:00.000Z";
const LATER = "2026-10-08T11:45:00.000Z";
const NEXT_DAY = "2026-10-09T10:45:00.000Z";
const DAY_3 = "2026-10-10T10:45:00.000Z";
const T0 = "2026-09-22T12:00:00.000Z";
const GROW = "AU-G-C-000832";
const PROCESSOR = "AU-P-000694";
const ALL_LICENSES = ["AU-G-C-000832", "AU-P-000694", "GR-C-001132", "AU-G-C-001397", "GR-C-001405", "AU-G-C-001509", "GR-C-002600"];

type Call = { path: string; license: string | null; page: number; start: string | null; end: string | null };
/** A route answers one page's rows (one envelope, TotalPages from the count) or a whole Response. */
type Route = (call: Call) => unknown[] | Response;

/** A fake Metrc keyed by endpoint path: every list answers one envelope of
 * rows with TotalPages 1 (an unlisted path answers an empty list), unless the
 * route hands back a Response of its own (a 500, a paged envelope). */
function fakeApi(routes: Record<string, Route | unknown[]>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string) => {
    const url = new URL(String(input));
    const call: Call = {
      path: url.pathname,
      license: url.searchParams.get("licenseNumber"),
      page: Number(url.searchParams.get("pageNumber")),
      start: url.searchParams.get("lastModifiedStart"),
      end: url.searchParams.get("lastModifiedEnd"),
    };
    calls.push(call);
    const route = routes[url.pathname];
    const rows = typeof route === "function" ? route(call) : (route ?? []);
    if (rows instanceof Response) return rows;
    const body = { Data: rows, Page: call.page, TotalPages: Math.max(1, Math.ceil(rows.length / 50)), TotalRecords: rows.length };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

/** One page of a longer series: the envelope names its page and TotalPages. */
function envelope(rows: unknown[], pageNumber: number, totalPages: number): Response {
  return new Response(JSON.stringify({ Data: rows, Page: pageNumber, TotalPages: totalPages, TotalRecords: rows.length }), { status: 200 });
}

const tag = (n: number): string => `1A40503000000000000${String(n).padStart(5, "0")}`;

function prodEnv(m: MigratedDb) {
  return { DB: m.db, ...KEYS, METRC_API_BASE: PROD };
}

const PROCESSOR_PACKAGES = { license: PROCESSOR, endpoint: PACKAGES_ACTIVE };
const GROW_PACKAGES = { license: GROW, endpoint: PACKAGES_ACTIVE };
const GROW_HARVESTS = { license: GROW, endpoint: HARVESTS_ACTIVE };

function setMode(m: MigratedDb, mode: string): void {
  m.run(`UPDATE app_config SET value = ? WHERE key = 'metrc_sweep_mode'`, mode);
}

function seedFacilities(m: MigratedDb, host: string, grow: Record<string, number | null>): void {
  for (const [license, flag] of Object.entries(grow)) {
    m.run(
      `INSERT INTO metrc_facilities (host, license_value, in_lookup, reached, can_grow_plants, checked_at) VALUES (?, ?, 1, 1, ?, ?)`,
      host,
      license,
      flag,
      "2026-10-08T09:00:00.000Z"
    );
  }
}

/** Every lookup license checked: the grow license grows, the others do not. */
function seedGrowOnly(m: MigratedDb, host: string): void {
  const flags: Record<string, number> = {};
  for (const license of ALL_LICENSES) flags[license] = license === GROW ? 1 : 0;
  seedFacilities(m, host, flags);
}

/** A package as seedMirror seeds it (so a seeded row reads unchanged). */
function pkg(label: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Label: label,
    SourceHarvestNames: null,
    SourcePackageLabels: null,
    LocationName: "Barn",
    SublocationName: null,
    Quantity: 750.5,
    UnitOfMeasureAbbreviation: "g",
    ProductionBatchNumber: null,
    SourceProductionBatchNumbers: null,
    LabTestingState: "TestPassed",
    IsFinishedGood: false,
    IsOnHold: false,
    IsOnRecall: false,
    PackagedDate: "2026-09-15",
    ReceivedDateTime: null,
    ExpirationDate: null,
    LabTestResultExpirationDateTime: null,
    Item: { Name: "WPR - Zebra Cake - PNN - O", ProductCategoryName: null, StrainName: "Zebra Cake" },
    ProductLabel: { OriginalSourcePackageLabel: null },
    ...over,
  };
}

function plant(label: string, phase: "Vegetative" | "Flowering", over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Label: label,
    GrowthPhase: phase,
    StrainName: "Spring Hill Kush",
    LocationName: "Plants Location",
    SublocationName: null,
    IsOnHold: false,
    PlantBatchName: "Demo Plant Batch",
    PlantBatchTypeName: "Seed",
    PlantedDate: "2026-05-27",
    VegetativeDate: "2026-06-10",
    FloweringDate: phase === "Flowering" ? "2026-08-03" : null,
    HarvestedDate: null,
    ...over,
  };
}

function harvest(id: number, name: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: id,
    Name: name,
    DryingLocationName: "Harvest Location",
    DryingSublocationName: null,
    PlantCount: 70,
    TotalWetWeight: 40.0,
    UnitOfWeightName: "Ounces",
    HarvestStartDate: "2026-09-20",
    FinishedDate: null,
    ArchivedDate: null,
    ...over,
  };
}

function seedPlant(m: MigratedDb, tag: string, license: string, phase: string, over: Record<string, unknown> = {}): void {
  m.run(
    `INSERT INTO metrc_plants (tag, license_value, phase, strain, location, sublocation, hold, plant_batch, plant_batch_type, plant_batch_date, phase_date, harvested, mount_id, first_seen_at, changed_at, gone_at)
     VALUES (?, ?, ?, 'Spring Hill Kush', 'Plants Location', NULL, 0, 'Demo Plant Batch', 'Seed', '2026-05-27', ?, 0, 'mount-1', ?, ?, ?)`,
    tag,
    license,
    phase,
    (over.phase_date as string) ?? (phase === "flowering" ? "2026-08-03" : "2026-06-10"),
    (over.first_seen_at as string) ?? "2026-09-22T12:00:00.000Z",
    (over.changed_at as string) ?? "2026-09-22T12:00:00.000Z",
    (over.gone_at as string) ?? null
  );
}

function seedHarvest(m: MigratedDb, id: number, name: string, license: string, state: string, over: Record<string, unknown> = {}): void {
  m.run(
    `INSERT INTO metrc_harvests (harvest_id, name, license_value, harvest_start_date, finished_date, archived_date, total_wet_weight, unit_of_weight, location, sublocation, state, plant_count, mount_id, first_seen_at, changed_at, gone_at)
     VALUES (?, ?, ?, '2026-09-20', ?, NULL, 40, 'Ounces', 'Harvest Location', NULL, ?, 70, 'mount-1', ?, ?, NULL)`,
    id,
    name,
    license,
    (over.finished_date as string) ?? null,
    state,
    (over.first_seen_at as string) ?? "2026-09-22T12:00:00.000Z",
    (over.changed_at as string) ?? "2026-09-22T12:00:00.000Z"
  );
}

function dump(m: MigratedDb, table: string, order: string): string {
  return JSON.stringify(m.all(`SELECT * FROM ${table} ORDER BY ${order}`));
}

function runs(m: MigratedDb): Array<Record<string, unknown>> {
  return m.all(
    `SELECT license_value, endpoint, kind, phase, mode, run_kind, status, message, pages, rows, calls, failures, would_add, would_update, would_gone, gone_held FROM metrc_sweep_runs ORDER BY started_at, license_value, endpoint`
  );
}

function fullRuns(m: MigratedDb): Array<Record<string, unknown>> {
  return runs(m).filter((row) => row.run_kind === "full");
}

/* ------------------------------------------------------------ the core */

describe("MA1 Law 1: planMirrorPass, the one reconcile", () => {
  const existing: MirrorExisting[] = [
    { key: "T1", strain: "A", location: "Row 1", phase: "flowering", license_value: GROW, gone_at: null },
    { key: "T2", strain: "A", location: "Row 2", phase: "flowering", license_value: GROW, gone_at: null },
    { key: "T4", strain: "B", location: "GH 2", phase: "flowering", license_value: GROW, gone_at: null },
    { key: "T5", strain: "C", location: "Barn", phase: "flowering", license_value: GROW, gone_at: "2026-09-01T00:00:00.000Z" },
    { key: "T6", strain: "C", location: "Barn", phase: "vegetative", license_value: GROW, gone_at: null },
    { key: "T8", strain: "D", location: "Barn", phase: "flowering", license_value: "GR-C-001132", gone_at: null },
  ];
  const incoming = [
    { tag: "T1", strain: "A", location: "Row 1" },
    { tag: "T2", strain: "A", location: "Row 9" },
    { tag: "T3", strain: "B", location: "GH 1" },
    { tag: "T5", strain: "C", location: "Barn" },
    { tag: "T6", strain: "C", location: "Barn" },
    { tag: "T8", strain: "D", location: "Barn" },
  ];
  const columns = ["strain", "location"];
  const scope = { kind: "plants" as const, license: GROW, phase: "flowering" };
  const live: LiveRow[] = [
    { key: "T1", changed_at: "2026-09-22T12:00:00.000Z", first_seen_at: "2026-09-22T12:00:00.000Z" },
    { key: "T2", changed_at: "2026-09-22T12:00:00.000Z", first_seen_at: "2026-09-22T12:00:00.000Z" },
    { key: "T4", changed_at: "2026-09-22T12:00:00.000Z", first_seen_at: "2026-09-22T12:00:00.000Z" },
    { key: "T9", changed_at: "2026-10-08T11:00:00.000Z", first_seen_at: "2026-09-22T12:00:00.000Z" },
    { key: "T10", changed_at: "2026-09-22T12:00:00.000Z", first_seen_at: "2026-10-08T11:30:00.000Z" },
  ];

  it("adds, updates (moved columns, a gone row returning, a phase or license change) and counts unchanged, as diffMount did", () => {
    const plan = planMirrorPass({ scope, incoming, existing, columns, complete: null });
    expect(plan.add.map((r) => r.tag)).toEqual(["T3"]);
    expect(plan.update.map((r) => r.tag)).toEqual(["T2", "T5", "T6", "T8"]);
    expect(plan.unchanged).toBe(1);
    expect(plan.gone).toEqual([]);
    expect(plan.wouldGone).toBe(0);
    expect(plan.goneHeld).toBe(false);
    expect(plan.labStateChanged).toBe(0);
  });

  it("marks gone only with a complete pass, within the live rows the pass missed, never rows changed or first seen after the pass began", () => {
    const seen = new Set(incoming.map((r) => r.tag));
    const incremental = planMirrorPass({ scope, incoming, existing, columns, live, complete: null, passStartedAt: NOW });
    expect(incremental.gone).toEqual([]);
    const complete = planMirrorPass({ scope, incoming, existing, columns, live, complete: { seen }, passStartedAt: NOW });
    // T4 was missed; T9 changed and T10 was first seen after the pass began, so neither is gone.
    expect(complete.gone).toEqual(["T4"]);
    expect(complete.wouldGone).toBe(1);
    const unguarded = planMirrorPass({ scope, incoming, existing, columns, live, complete: { seen } });
    expect(unguarded.gone).toEqual(["T4", "T9", "T10"]);
  });

  it("A29: holds the gone marks when the pass read 0 rows against live rows or would mark more than the share, unless the override is set", () => {
    const zero = planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set() }, goneHoldShare: 0.5 });
    expect(zero).toMatchObject({ gone: [], wouldGone: 5, goneHeld: true, overrideUsed: false });
    const twoOfFive = planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set(["T1", "T2", "T4"]) }, goneHoldShare: 0.5 });
    expect(twoOfFive).toMatchObject({ gone: ["T9", "T10"], wouldGone: 2, goneHeld: false });
    const threeOfFive = planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set(["T1", "T2"]) }, goneHoldShare: 0.5 });
    expect(threeOfFive).toMatchObject({ gone: [], wouldGone: 3, goneHeld: true, overrideUsed: false });
    const overridden = planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set(["T1", "T2"]) }, goneHoldShare: 0.5, goneOverride: true });
    expect(overridden).toMatchObject({ gone: ["T4", "T9", "T10"], wouldGone: 3, goneHeld: false, overrideUsed: true });
    // The override is consumed by a complete pass the guard would have let through too (it marks as any pass would), so the caller resets it either way.
    const overrideClean = planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set(["T1", "T2", "T4"]) }, goneHoldShare: 0.5, goneOverride: true });
    expect(overrideClean).toMatchObject({ gone: ["T9", "T10"], wouldGone: 2, goneHeld: false, overrideUsed: true });
    expect(planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set(["T1", "T2", "T4"]) }, goneHoldShare: 0.5 })).toMatchObject({ overrideUsed: false });
    // The 0-rows arm holds on its own: with a share of 1 the share arm never fires, so only rowsRead decides.
    const zeroRead = planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set(), rowsRead: 0 }, passStartedAt: NOW, goneHoldShare: 1 });
    expect(zeroRead).toMatchObject({ wouldGone: 3, goneHeld: true, gone: [] });
    const oneRead = planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set(), rowsRead: 1 }, passStartedAt: NOW, goneHoldShare: 1 });
    expect(oneRead).toMatchObject({ wouldGone: 3, goneHeld: false, gone: ["T1", "T2", "T4"] });
    // No live rows: nothing to hold.
    expect(planMirrorPass({ scope, incoming: [], existing: [], columns, live: [], complete: { seen: new Set() }, goneHoldShare: 0.5 })).toMatchObject({ goneHeld: false, wouldGone: 0 });
    // The CSV door runs no guard.
    expect(planMirrorPass({ scope, incoming: [], existing: [], columns, live, complete: { seen: new Set() }, goneHoldShare: null })).toMatchObject({ gone: ["T1", "T2", "T4", "T9", "T10"], goneHeld: false });
  });

  it("keeps samples in a deterministic order, capped, naming the key, the column, the mirror value and the API value", () => {
    const seen = new Set(incoming.map((r) => r.tag));
    const plan = planMirrorPass({ scope, incoming, existing, columns, live, complete: { seen }, passStartedAt: NOW, sampleCap: 25 });
    expect(plan.samples).toEqual([
      { key: "T2", column: "location", mirrorValue: "Row 2", apiValue: "Row 9" },
      { key: "T3", column: "(added)", mirrorValue: null, apiValue: "added" },
      { key: "T5", column: "gone_at", mirrorValue: "2026-09-01T00:00:00.000Z", apiValue: null },
      { key: "T6", column: "phase", mirrorValue: "vegetative", apiValue: "flowering" },
      { key: "T8", column: "license_value", mirrorValue: "GR-C-001132", apiValue: GROW },
      { key: "T4", column: "(gone)", mirrorValue: "live", apiValue: null },
    ]);
    const capped = planMirrorPass({ scope, incoming, existing, columns, live, complete: { seen }, passStartedAt: NOW, sampleCap: 2 });
    expect(capped.samples).toEqual(plan.samples.slice(0, 2));
    // The cap changes no decision.
    expect(capped.update.map((r) => r.tag)).toEqual(plan.update.map((r) => r.tag));
    expect(capped.gone).toEqual(plan.gone);
    expect(planMirrorPass({ scope, incoming, existing, columns, sampleCap: 0 }).samples).toEqual([]);
  });

  it("counts a package's lab status moves and keys harvests by id", () => {
    const pkgScope = { kind: "packages" as const, license: GROW, phase: null };
    const plan = planMirrorPass({
      scope: pkgScope,
      incoming: [
        { tag: "P1", lab_test_status: "TestPassed", location: "Barn" },
        { tag: "P2", lab_test_status: "TestPassed", location: "Barn" },
        { tag: "P3", lab_test_status: null, location: "Barn" },
        { tag: "P4", lab_test_status: "SubmittedForTesting", location: "Barn" },
      ],
      existing: [
        { key: "P1", lab_test_status: "SubmittedForTesting", location: "Barn", license_value: GROW, gone_at: null },
        { key: "P2", lab_test_status: "TestPassed", location: "Barn", license_value: GROW, gone_at: null },
      ],
      columns: ["lab_test_status", "location"],
    });
    expect(plan.labStateChanged).toBe(2);
    expect(plan.add.map((r) => r.tag)).toEqual(["P3", "P4"]);
    expect(plan.update.map((r) => r.tag)).toEqual(["P1"]);
    const harvests = planMirrorPass({
      scope: { kind: "harvests", license: GROW, phase: null },
      incoming: [{ harvest_id: 7, name: "H7", state: "inactive" }],
      existing: [{ key: "7", name: "H7", state: "active", license_value: GROW, gone_at: null }],
      columns: ["name", "state"],
      live: [{ key: "7", changed_at: null, first_seen_at: null }],
      complete: { seen: new Set(["7"]) },
    });
    expect(harvests.update).toHaveLength(1);
    expect(harvests.gone).toEqual([]);
    expect(harvests.samples).toEqual([{ key: "7", column: "state", mirrorValue: "active", apiValue: "inactive" }]);
  });
});

/* ------------------------------------------------------------ the sweep */

describe("MA1 Law 7: the sweep's modes", () => {
  it("off (the seed) records one skipped run row and makes no call", async () => {
    const m = await migratedDb();
    const api = fakeApi({});
    const env = { DB: m.db, ...KEYS, METRC_API_BASE: PROD };
    const result = await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(result).toMatchObject({ mode: "off", status: "skipped", message: SWEEP_OFF_WORDS, runs: 0, calls: 0 });
    expect(runs(m)).toEqual([{ license_value: "*", endpoint: "*", kind: "sweep", phase: null, mode: "off", run_kind: "tick", status: "skipped", message: SWEEP_OFF_WORDS, pages: null, rows: null, calls: null, failures: null, would_add: null, would_update: null, would_gone: null, gone_held: 0 }]);
    expect(api.calls).toHaveLength(0);
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
    // The keys absent: one skipped row naming the absence, no call.
    setMode(m, "dry_run");
    const absent = await runMirrorSweep({ DB: m.db, METRC_API_BASE: PROD }, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(absent).toMatchObject({ mode: "dry_run", status: "skipped", message: "The integrator key is absent. The user key is absent." });
    expect(runs(m)).toHaveLength(2);
    expect(api.calls).toHaveLength(0);
  });

  it("dry_run reads, plans against the mirror, writes nothing to the mirror tables or mounts, and records counts and samples", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    seedGrowOnly(m, SANDBOX_HOST);
    seedMirror(m, { tag: "1A4050300000000000000P01", license: GROW, location: "Barn", grams: 750.5 });
    seedMirror(m, { tag: "1A4050300000000000000P02", license: GROW, location: "Barn", grams: 750.5 });
    seedMirror(m, { tag: "1A4050300000000000000P03", license: GROW, location: "Barn", grams: 750.5 });
    seedPlant(m, "1A4050000000000000000V01", GROW, "vegetative");
    seedHarvest(m, 1, "26257-PNN-OD-070-0-01-26010", GROW, "active");
    const before = {
      packages: dump(m, "metrc_packages", "tag"),
      plants: dump(m, "metrc_plants", "tag"),
      harvests: dump(m, "metrc_harvests", "harvest_id"),
      mounts: dump(m, "metrc_mounts", "id"),
    };
    const api = fakeApi({
      [PACKAGES_ACTIVE]: (call) => (call.license === GROW ? [pkg("1A4050300000000000000P01"), pkg("1A4050300000000000000P02", { LocationName: "Trim Room" }), pkg("1A4050300000000000000P04")] : []),
      [PLANTS_VEGETATIVE]: [plant("1A4050000000000000000V01", "Vegetative", { LocationName: "West 3" }), plant("1A4050000000000000000V02", "Vegetative")],
      [PLANTS_FLOWERING]: [plant("1A4050000000000000000F01", "Flowering")],
      [HARVESTS_ACTIVE]: [harvest(1, "26257-PNN-OD-070-0-01-26010", { PlantCount: 71 })],
      [HARVESTS_INACTIVE]: [harvest(2, "26200-PNN-OD-069-0-01-26009", { FinishedDate: "2026-10-01" })],
    });
    const env = { DB: m.db, ...KEYS, METRC_API_BASE: SANDBOX };
    const result = await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(result).toMatchObject({ mode: "dry_run", status: "ok" });
    expect(dump(m, "metrc_packages", "tag")).toBe(before.packages);
    expect(dump(m, "metrc_plants", "tag")).toBe(before.plants);
    expect(dump(m, "metrc_harvests", "harvest_id")).toBe(before.harvests);
    expect(dump(m, "metrc_mounts", "id")).toBe(before.mounts);
    // Seven packages scopes plus the grow license's four, every one a complete full pass.
    const rows = runs(m);
    expect(rows).toHaveLength(11);
    expect(rows.every((row) => row.mode === "dry_run" && row.run_kind === "full" && row.status === "ok")).toBe(true);
    const packages = rows.find((row) => row.license_value === GROW && row.endpoint === PACKAGES_ACTIVE);
    expect(packages).toMatchObject({ would_add: 1, would_update: 1, would_gone: 1, gone_held: 0, pages: 2, rows: 3, calls: 2 });
    expect(rows.find((row) => row.license_value === GROW && row.endpoint === PLANTS_VEGETATIVE)).toMatchObject({ would_add: 1, would_update: 1, would_gone: 0 });
    expect(rows.find((row) => row.license_value === GROW && row.endpoint === PLANTS_FLOWERING)).toMatchObject({ would_add: 1, would_update: 0, would_gone: 0 });
    expect(rows.find((row) => row.license_value === GROW && row.endpoint === HARVESTS_ACTIVE)).toMatchObject({ would_add: 0, would_update: 1, would_gone: 0 });
    expect(rows.find((row) => row.license_value === GROW && row.endpoint === HARVESTS_INACTIVE)).toMatchObject({ would_add: 1, would_update: 0, would_gone: 0 });
    expect(rows.find((row) => row.license_value === PROCESSOR && row.endpoint === PACKAGES_ACTIVE)).toMatchObject({ would_add: 0, would_update: 0, would_gone: 0, calls: 2 });
    // The samples name the tag, the column, the mirror's value and the API's.
    const samples = m.all(
      `SELECT s.tag, s.column_name, s.mirror_value, s.api_value FROM metrc_sweep_samples s
       JOIN metrc_sweep_runs r ON r.id = s.run_id WHERE r.endpoint = ? AND r.license_value = ? ORDER BY s.rowid`,
      PACKAGES_ACTIVE,
      GROW
    );
    expect(samples).toEqual([
      { tag: "1A4050300000000000000P02", column_name: "location", mirror_value: "Barn", api_value: "Trim Room" },
      { tag: "1A4050300000000000000P04", column_name: "(added)", mirror_value: null, api_value: "added" },
      { tag: "1A4050300000000000000P03", column_name: "(gone)", mirror_value: "live", api_value: null },
    ]);
    // Every call carries the host (A18) and the processor read packages only.
    expect(m.all(`SELECT DISTINCT host FROM metrc_api_calls`).map((row) => row.host)).toEqual([SANDBOX_HOST]);
    expect(api.calls.filter((call) => call.license === PROCESSOR).map((call) => call.path)).toEqual([PACKAGES_ACTIVE, ONHOLD_ENDPOINTS.packages]);
    expect(api.calls.filter((call) => call.license === GROW).map((call) => call.path)).toEqual([
      PACKAGES_ACTIVE,
      ONHOLD_ENDPOINTS.packages,
      HARVESTS_INACTIVE,
      HARVESTS_ACTIVE,
      ONHOLD_ENDPOINTS.harvests,
      PLANTS_VEGETATIVE,
      ONHOLD_ENDPOINTS.plants,
      PLANTS_FLOWERING,
      ONHOLD_ENDPOINTS.plants,
    ]);
    // The dry run's cursors live apart from any write cursor (A26).
    expect(m.all(`SELECT DISTINCT mode FROM metrc_cursors`).map((row) => row.mode)).toEqual(["dry_run"]);
  });

  it("refuses write mode on a sandbox host: the tick's row says why, the scopes run as a dry run, and the mirror is untouched", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, SANDBOX_HOST);
    seedMirror(m, { tag: "1A4050300000000000000P01", license: GROW });
    const before = dump(m, "metrc_packages", "tag");
    const api = fakeApi({ [PACKAGES_ACTIVE]: (call) => (call.license === GROW ? [pkg("1A4050300000000000000P09")] : []) });
    const env = { DB: m.db, ...KEYS, METRC_API_BASE: SANDBOX };
    const result = await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(result.mode).toBe("dry_run");
    const rows = runs(m);
    expect(rows[0]).toMatchObject({ license_value: "*", status: "mode_refused", message: SWEEP_WRITE_ON_SANDBOX, mode: "dry_run" });
    expect(rows.slice(1).every((row) => row.mode === "dry_run")).toBe(true);
    expect(dump(m, "metrc_packages", "tag")).toBe(before);
    expect(m.all(`SELECT * FROM metrc_mounts`)).toHaveLength(0);
    expect(m.all(`SELECT DISTINCT mode FROM metrc_cursors`).map((row) => row.mode)).toEqual(["dry_run"]);
  });
});

describe("MA1 Law 1 and Law 7: write mode on a production host", () => {
  it("writes an api mount per license, kind and phase per UTC day, reuses it, updates counts, marks gone only after a complete pass; an incremental never marks gone", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedMirror(m, { tag: "1A4050300000000000000P01", license: GROW, location: "Barn", grams: 750.5 });
    seedMirror(m, { tag: "1A4050300000000000000P02", license: GROW, location: "Barn", grams: 750.5 });
    seedMirror(m, { tag: "1A4050300000000000000P03", license: GROW, location: "Barn", grams: 750.5 });
    // Our own field on a tag the pass will update: never touched by a sweep.
    m.run(
      `INSERT INTO internal_field_values (id, tag, field_key, value, created_at, created_by, updated_at, updated_by) VALUES ('f1', '1A4050300000000000000P02', 'notes', 'keep me', ?, 'person-1', ?, 'person-1')`,
      "2026-09-22T12:00:00.000Z",
      "2026-09-22T12:00:00.000Z"
    );
    const fieldsBefore = dump(m, "internal_field_values", "id");
    let incrementalRows: Record<string, unknown>[] = [];
    const api = fakeApi({
      [PACKAGES_ACTIVE]: (call) => {
        if (call.license !== GROW) return [];
        if (call.start) return incrementalRows;
        return [pkg("1A4050300000000000000P01"), pkg("1A4050300000000000000P02", { LocationName: "Trim Room", LabTestingState: "SubmittedForTesting" }), pkg("1A4050300000000000000P04")];
      },
      [PLANTS_VEGETATIVE]: (call) => (call.start ? [] : [plant("1A4050000000000000000V01", "Vegetative"), plant("1A4050000000000000000V02", "Vegetative")]),
      [PLANTS_FLOWERING]: (call) => (call.start ? [] : [plant("1A4050000000000000000F01", "Flowering")]),
    });
    const env = { DB: m.db, ...KEYS, METRC_API_BASE: PROD };
    const tick1 = await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(tick1).toMatchObject({ mode: "write", status: "ok", runs: 11 });
    // The mirror: P4 added, P2 updated in place, P1 unchanged, P3 gone, all under the day's api mount.
    const mounts = m.all(`SELECT id, kind, phase, license_value, filename, file_format, source, rows_total, rows_added, rows_updated, rows_unchanged, rows_gone, created_by FROM metrc_mounts ORDER BY kind, license_value, phase`);
    expect(mounts.every((row) => row.source === "api" && row.file_format === "json" && row.created_by == null)).toBe(true);
    const pkgMount = mounts.find((row) => row.kind === "packages" && row.license_value === GROW);
    expect(pkgMount).toMatchObject({ filename: PACKAGES_ACTIVE, phase: null, rows_total: 3, rows_added: 1, rows_updated: 1, rows_unchanged: 1, rows_gone: 1 });
    expect(mounts.filter((row) => row.kind === "plants").map((row) => [row.phase, row.rows_added])).toEqual([
      ["flowering", 1],
      ["vegetative", 2],
    ]);
    expect(mounts.find((row) => row.kind === "harvests")).toMatchObject({ filename: HARVESTS_MOUNT_NAME, rows_added: 0 });
    const packages = m.all(`SELECT tag, location, lab_test_status, mount_id, gone_at, gone_mount_id FROM metrc_packages WHERE license_value = ? ORDER BY tag`, GROW);
    expect(packages).toEqual([
      { tag: "1A4050300000000000000P01", location: "Barn", lab_test_status: "TestPassed", mount_id: "mount-1", gone_at: null, gone_mount_id: null },
      { tag: "1A4050300000000000000P02", location: "Trim Room", lab_test_status: "SubmittedForTesting", mount_id: pkgMount?.id, gone_at: null, gone_mount_id: null },
      { tag: "1A4050300000000000000P03", location: "Barn", lab_test_status: "TestPassed", mount_id: "mount-1", gone_at: NOW, gone_mount_id: pkgMount?.id },
      { tag: "1A4050300000000000000P04", location: "Barn", lab_test_status: "TestPassed", mount_id: pkgMount?.id, gone_at: null, gone_mount_id: null },
    ]);
    expect(m.all(`SELECT tag, phase FROM metrc_plants ORDER BY tag`)).toEqual([
      { tag: "1A4050000000000000000F01", phase: "flowering" },
      { tag: "1A4050000000000000000V01", phase: "vegetative" },
      { tag: "1A4050000000000000000V02", phase: "vegetative" },
    ]);
    expect(dump(m, "internal_field_values", "id")).toBe(fieldsBefore);
    // The mount's insert logs once (actor null, the sweep's reason) and the 4 count logs land on the complete pass.
    const logs = m.all(`SELECT field, new_value, actor_person_id, reason FROM record_change_log WHERE record_table = 'metrc_mounts' AND record_id = ? ORDER BY rowid`, String(pkgMount?.id));
    expect(logs.every((row) => row.actor_person_id == null && row.reason === SYSTEM_REASON.metrc_sweep)).toBe(true);
    expect(logs.filter((row) => row.field === "source").map((row) => row.new_value)).toEqual(["api"]);
    expect(logs.filter((row) => ["rows_added", "rows_updated", "rows_unchanged", "rows_gone"].includes(String(row.field))).map((row) => [row.field, row.new_value])).toEqual([
      ["rows_added", "1"],
      ["rows_updated", "1"],
      ["rows_unchanged", "1"],
      ["rows_gone", "1"],
    ]);
    const runRow = runs(m).find((row) => row.license_value === GROW && row.endpoint === PACKAGES_ACTIVE);
    expect(runRow).toMatchObject({ mode: "write", run_kind: "full", status: "ok", would_add: 1, would_update: 1, would_gone: 1, gone_held: 0 });
    expect(m.all(`SELECT DISTINCT mode FROM metrc_cursors`).map((row) => row.mode)).toEqual(["write"]);
    expect((await loadCursor(m.db, { host: PROD_HOST, license: GROW, endpoint: PACKAGES_ACTIVE, mode: "write", kind: "packages", phase: null }))?.hwm_end).toBe("2026-10-08T10:45:00Z");

    // Tick 2, an hour later, the same UTC day: incrementals only, the mount reused, counts updated, nothing marked gone.
    incrementalRows = [pkg("1A4050300000000000000P05"), pkg("1A4050300000000000000P04", { LocationName: "Vault" })];
    const callsBefore = api.calls.length;
    const tick2 = await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => LATER, clock: () => 0 });
    expect(tick2).toMatchObject({ mode: "write", status: "ok", runs: 11 });
    expect(api.calls.slice(callsBefore).every((call) => call.start != null && call.end != null)).toBe(true);
    expect(m.all(`SELECT COUNT(*) AS n FROM metrc_mounts`)[0].n).toBe(10);
    expect(m.get(`SELECT rows_total, rows_added, rows_updated, rows_unchanged, rows_gone FROM metrc_mounts WHERE id = ?`, String(pkgMount?.id))).toEqual({ rows_total: 5, rows_added: 2, rows_updated: 2, rows_unchanged: 1, rows_gone: 1 });
    expect(m.all(`SELECT tag, location, gone_at FROM metrc_packages WHERE license_value = ? ORDER BY tag`, GROW)).toEqual([
      { tag: "1A4050300000000000000P01", location: "Barn", gone_at: null },
      { tag: "1A4050300000000000000P02", location: "Trim Room", gone_at: null },
      { tag: "1A4050300000000000000P03", location: "Barn", gone_at: NOW },
      { tag: "1A4050300000000000000P04", location: "Vault", gone_at: null },
      { tag: "1A4050300000000000000P05", location: "Barn", gone_at: null },
    ]);
    expect(runs(m).filter((row) => row.run_kind === "incremental")).toHaveLength(11);
    expect(runs(m).find((row) => row.run_kind === "incremental" && row.license_value === GROW && row.endpoint === PACKAGES_ACTIVE)).toMatchObject({ would_add: 1, would_update: 1, would_gone: 0, gone_held: 0, status: "ok" });
    // The count logs did not land again (no full pass completed this tick).
    expect(m.all(`SELECT field FROM record_change_log WHERE record_table = 'metrc_mounts' AND record_id = ? AND field = 'rows_added'`, String(pkgMount?.id))).toHaveLength(1);

    // Tick 3, the next UTC day: the daily passes are due again and a new mount is written.
    incrementalRows = [];
    const tick3 = await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => NEXT_DAY, clock: () => 0 });
    expect(tick3.status).toBe("ok");
    expect(m.all(`SELECT COUNT(*) AS n FROM metrc_mounts WHERE kind = 'packages' AND license_value = ?`, GROW)[0].n).toBe(2);
    expect(dump(m, "internal_field_values", "id")).toBe(fieldsBefore);
  });

  it("A29 end to end: a pass that reads 0 rows against live rows holds its gone marks and closes nothing; the cursor's override marks once and resets", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedMirror(m, { tag: "1A4050300000000000000Q01", license: PROCESSOR });
    seedMirror(m, { tag: "1A4050300000000000000Q02", license: PROCESSOR });
    const api = fakeApi({});
    const env = { DB: m.db, ...KEYS, METRC_API_BASE: PROD };
    await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    const held = runs(m).find((row) => row.license_value === PROCESSOR && row.endpoint === PACKAGES_ACTIVE);
    expect(held).toMatchObject({ status: "ok", would_gone: 2, gone_held: 1, message: GONE_HELD_WORDS });
    expect(m.all(`SELECT gone_at FROM metrc_packages WHERE license_value = ?`, PROCESSOR).every((row) => row.gone_at == null)).toBe(true);
    const cursor = await loadCursor(m.db, { host: PROD_HOST, license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "write", kind: "packages", phase: null });
    expect(cursor?.full_completed_at).toBe("2026-10-08T10:45:00Z");
    // Dennis confirms on the Admin page (Phase D) by setting the override; the next complete pass marks and resets it.
    m.run(`UPDATE metrc_cursors SET gone_override = 1 WHERE id = ?`, String(cursor?.id));
    await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => NEXT_DAY, clock: () => 0 });
    expect(m.all(`SELECT gone_at FROM metrc_packages WHERE license_value = ?`, PROCESSOR).every((row) => row.gone_at === NEXT_DAY)).toBe(true);
    expect(m.get(`SELECT gone_override FROM metrc_cursors WHERE id = ?`, String(cursor?.id))).toEqual({ gone_override: 0 });
    const marked = runs(m).filter((row) => row.license_value === PROCESSOR && row.endpoint === PACKAGES_ACTIVE && row.run_kind === "full");
    expect(marked[marked.length - 1]).toMatchObject({ would_gone: 2, gone_held: 0 });
  });

  it("harvests: a state change is an update, the gone rule holds, and inactive rows outside the finished-days scope are not written", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedHarvest(m, 1, "26257-PNN-OD-070-0-01-26010", GROW, "active");
    seedHarvest(m, 2, "26258-PNN-OD-070-0-01-26011", GROW, "active");
    seedHarvest(m, 3, "26259-PNN-OD-071-0-01-26012", GROW, "active");
    seedHarvest(m, 9, "26200-PNN-OD-060-0-01-26001", GROW, "active");
    seedHarvest(m, 20, "25100-PNN-OD-010-0-01-25001", GROW, "inactive", { finished_date: "2025-01-10" });
    const api = fakeApi({
      [HARVESTS_ACTIVE]: (call) => (call.license === GROW ? [harvest(3, "26259-PNN-OD-071-0-01-26012"), harvest(4, "26260-PNN-OD-072-0-01-26013")] : []),
      [HARVESTS_INACTIVE]: (call) =>
        call.license === GROW
          ? [
              harvest(1, "26257-PNN-OD-070-0-01-26010", { FinishedDate: "2026-10-01" }),
              harvest(2, "26258-PNN-OD-070-0-01-26011", { FinishedDate: null, ArchivedDate: "2026-10-05" }),
              harvest(20, "25100-PNN-OD-010-0-01-25001", { FinishedDate: "2025-01-10", DryingLocationName: "Old Barn" }),
              harvest(21, "25101-PNN-OD-011-0-01-25002", { FinishedDate: "2025-02-01" }),
              harvest(22, "25102-PNN-OD-012-0-01-25003", { FinishedDate: null, ArchivedDate: null }),
            ]
          : [],
    });
    const env = { DB: m.db, ...KEYS, METRC_API_BASE: PROD };
    const result = await runMirrorSweep(env, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(result.status).toBe("ok");
    const rows = m.all(`SELECT harvest_id, state, finished_date, archived_date, location, gone_at FROM metrc_harvests ORDER BY harvest_id`);
    expect(rows).toEqual([
      // Moved active to inactive: an in-place update, never gone.
      { harvest_id: 1, state: "inactive", finished_date: "2026-10-01", archived_date: null, location: "Harvest Location", gone_at: null },
      { harvest_id: 2, state: "inactive", finished_date: null, archived_date: "2026-10-05", location: "Harvest Location", gone_at: null },
      { harvest_id: 3, state: "active", finished_date: null, archived_date: null, location: "Harvest Location", gone_at: null },
      { harvest_id: 4, state: "active", finished_date: null, archived_date: null, location: "Harvest Location", gone_at: null },
      // Missed by the complete active pass, seen by no inactive or onhold read: gone.
      { harvest_id: 9, state: "active", finished_date: null, archived_date: null, location: "Harvest Location", gone_at: NOW },
      // Outside the 30-day scope but already held: it still takes its state and columns.
      { harvest_id: 20, state: "inactive", finished_date: "2025-01-10", archived_date: null, location: "Old Barn", gone_at: null },
      // 21 (finished in 2025) and 22 (no date) are outside the scope and never inserted.
    ]);
    const active = runs(m).find((row) => row.license_value === GROW && row.endpoint === HARVESTS_ACTIVE);
    expect(active).toMatchObject({ would_add: 1, would_update: 0, would_gone: 1, gone_held: 0 });
    const inactive = runs(m).find((row) => row.license_value === GROW && row.endpoint === HARVESTS_INACTIVE);
    expect(inactive).toMatchObject({ would_add: 0, would_update: 3, would_gone: 0 });
    expect(String(inactive?.message)).toContain("2 inactive harvests outside the 30-day scope were not written.");
    // One mount a day serves both harvest lists, so its name says so (never the active list's path alone).
    expect(HARVESTS_MOUNT_NAME).toBe("/harvests/v2/active+inactive");
    expect(m.get(`SELECT kind, phase, filename, rows_added, rows_updated, rows_gone FROM metrc_mounts WHERE kind = 'harvests'`)).toEqual({ kind: "harvests", phase: null, filename: HARVESTS_MOUNT_NAME, rows_added: 1, rows_updated: 3, rows_gone: 1 });
  });

  it("the CSV door still stamps file, and the parity fixture: one mount's CSV rows and the same rows as API JSON reconcile to identical mirror rows", async () => {
    const PKG_CSV = `${METRC_PACKAGE_COLUMNS.join(",")}\r
1A4050300000000000000A01,"46258-PNN-ID-062-0-NA-26007, 46258-PNN-ID-062-0-NA-26008",1A4050100000000000000B01,,,Trim Room,,WIP - Placeholder - PNN - I,Buds,Placeholder,29220,g,,,NotSubmitted,False,False,False,9/1/2026 12:00:00 AM,,,\r
1a4050300000000000000a02,45951-PNN-OD-051-0-02-25162,,,,Barn,,GRIP Vape - Elsewhere - 2g,Vape Cart,,"1,235",ea,PB-7,,TestPassed,True,False,False,2025-12-01,2025-12-02,2026-12-01,2026-06-30\r
`;
    const PLANTS_CSV = `${METRC_PLANT_COLUMNS.join(",")}\r
1A4050000000000000000001,Bermuda Triangle,West 3,,False,Bermuda Triangle 5/27/2026 & Co,Seed,5/27/2026,8/3/2026,0\r
1A4050000000000000000002,Bermuda Triangle,West 4,,True,Bermuda Triangle 5/27/2026 & Co,Seed,2026-05-27,2026-08-03,1\r
`;
    const apiPackages = [
      pkg("1A4050300000000000000A01", {
        SourceHarvestNames: "46258-PNN-ID-062-0-NA-26007, 46258-PNN-ID-062-0-NA-26008",
        SourcePackageLabels: "1A4050100000000000000B01",
        LocationName: "Trim Room",
        Quantity: 29220,
        UnitOfMeasureAbbreviation: "g",
        LabTestingState: "NotSubmitted",
        PackagedDate: "2026-09-01",
        Item: { Name: "WIP - Placeholder - PNN - I", ProductCategoryName: "Buds", StrainName: "Placeholder" },
      }),
      pkg("1a4050300000000000000a02", {
        SourceHarvestNames: "45951-PNN-OD-051-0-02-25162",
        SourcePackageLabels: null,
        LocationName: "Barn",
        Quantity: 1235.0,
        UnitOfMeasureAbbreviation: "ea",
        ProductionBatchNumber: "PB-7",
        LabTestingState: "TestPassed",
        IsFinishedGood: true,
        PackagedDate: "2025-12-01",
        // 20:30 Eastern on 12-02 (the 01:30 UTC instant of 12-03): A25 lands the receipt on the 2nd.
        ReceivedDateTime: "2025-12-03T01:30:00+00:00",
        ExpirationDate: "2026-12-01",
        LabTestResultExpirationDateTime: "2026-06-30T23:00:00+00:00",
        Item: { Name: "GRIP Vape - Elsewhere - 2g", ProductCategoryName: "Vape Cart", StrainName: null },
      }),
    ];
    const apiPlants = [
      plant("1A4050000000000000000001", "Flowering", { StrainName: "Bermuda Triangle", LocationName: "West 3", PlantBatchName: "Bermuda Triangle 5/27/2026 & Co", PlantedDate: "2026-05-27", FloweringDate: "2026-08-03" }),
      plant("1A4050000000000000000002", "Flowering", { StrainName: "Bermuda Triangle", LocationName: "West 4", PlantBatchName: "Bermuda Triangle 5/27/2026 & Co", PlantedDate: "2026-05-27", FloweringDate: "2026-08-03", IsOnHold: true, HarvestedDate: "2026-10-01" }),
    ];
    // The file door.
    const file = await migratedDb();
    const person = seedPerson(file);
    const pkgForm = new FormData();
    pkgForm.set("person_id", person);
    pkgForm.set("file", new File([new TextEncoder().encode(PKG_CSV)], "MetrcMichiganAUGC000832PackagesActive_1.csv", { type: "text/csv" }));
    await mountMetrcExport(file.db, pkgForm);
    const plantForm = new FormData();
    plantForm.set("person_id", person);
    plantForm.set("file", new File([new TextEncoder().encode(PLANTS_CSV)], "MetrcMichiganAUGC000832PlantsFlowering_1.csv", { type: "text/csv" }));
    await mountMetrcExport(file.db, plantForm);
    expect(file.all(`SELECT source, file_format, created_by FROM metrc_mounts ORDER BY created_at`)).toEqual([
      { source: "file", file_format: "csv", created_by: person },
      { source: "file", file_format: "csv", created_by: person },
    ]);
    // The API door.
    const api = await migratedDb();
    setMode(api, "write");
    seedGrowOnly(api, PROD_HOST);
    const fake = fakeApi({
      [PACKAGES_ACTIVE]: (call) => (call.license === GROW ? apiPackages : []),
      [PLANTS_FLOWERING]: (call) => (call.license === GROW ? apiPlants : []),
    });
    const result = await runMirrorSweep({ DB: api.db, ...KEYS, METRC_API_BASE: PROD }, "cron", { fetchImpl: fake.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(result.status).toBe("ok");
    expect(api.all(`SELECT DISTINCT source FROM metrc_mounts`).map((row) => row.source)).toEqual(["api"]);
    const pkgCols = ["tag", "license_value", "source_harvests", "source_packages", "original_source_label", "source_processing_jobs", "location", "sublocation", "item", "category", "item_strain", "quantity", "uom", "production_batch", "source_production_batch", "lab_test_status", "finished_goods", "admin_hold", "admin_recall", "packaged_date", "received_date", "expiration_date", "lab_test_expiration", "gone_at"];
    const plantCols = ["tag", "license_value", "phase", "strain", "location", "sublocation", "hold", "plant_batch", "plant_batch_type", "plant_batch_date", "phase_date", "harvested", "gone_at"];
    const filePackages = file.all(`SELECT ${pkgCols.join(", ")} FROM metrc_packages ORDER BY tag`);
    const apiPackagesRows = api.all(`SELECT ${pkgCols.join(", ")} FROM metrc_packages ORDER BY tag`);
    expect(filePackages).toHaveLength(2);
    expect(apiPackagesRows).toEqual(filePackages);
    expect(filePackages[1]).toMatchObject({ tag: "1A4050300000000000000A02", quantity: 1235, uom: "ea", finished_goods: 1, received_date: "2025-12-02", lab_test_expiration: "2026-06-30", production_batch: "PB-7" });
    const filePlants = file.all(`SELECT ${plantCols.join(", ")} FROM metrc_plants ORDER BY tag`);
    expect(filePlants).toHaveLength(2);
    expect(api.all(`SELECT ${plantCols.join(", ")} FROM metrc_plants ORDER BY tag`)).toEqual(filePlants);
    expect(filePlants[1]).toMatchObject({ hold: 1, harvested: 1, plant_batch_date: "2026-05-27", phase_date: "2026-08-03", phase: "flowering" });
  });
});

describe("MA1 Law 5: licenses, routing and retention", () => {
  it("sweeps packages only for a license that cannot grow plants, treats an unlisted license as grow once the host is checked, and waits before", () => {
    const checked = { checked: true, grow: new Map([[GROW, true], [PROCESSOR, false]]) };
    expect(growsPlants(GROW, checked)).toBe("grow");
    expect(growsPlants(PROCESSOR, checked)).toBe("packages_only");
    expect(growsPlants("GR-C-001132", checked)).toBe("grow");
    expect(growsPlants("gr-c-001132", { checked: false, grow: new Map() })).toBe("unchecked");
    const scopes = mirrorScopes(PROD_HOST, "write", [GROW, PROCESSOR], (license) => license === GROW);
    expect(scopes.map((scope) => [scope.license, scope.endpoint, scope.kind, scope.phase])).toEqual([
      [GROW, PACKAGES_ACTIVE, "packages", null],
      [PROCESSOR, PACKAGES_ACTIVE, "packages", null],
      [GROW, PLANTS_VEGETATIVE, "plants", "vegetative"],
      [GROW, PLANTS_FLOWERING, "plants", "flowering"],
      [GROW, HARVESTS_INACTIVE, "harvests", null],
      [GROW, HARVESTS_ACTIVE, "harvests", null],
    ]);
  });

  it("before Test connection has run on the host, every license sweeps packages only and a run row says plants and harvests wait", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    const api = fakeApi({});
    await runMirrorSweep({ DB: m.db, ...KEYS, METRC_API_BASE: PROD }, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(new Set(api.calls.map((call) => call.path))).toEqual(new Set([PACKAGES_ACTIVE, ONHOLD_ENDPOINTS.packages]));
    const waiting = runs(m).filter((row) => row.status === "skipped");
    expect(waiting).toHaveLength(7);
    expect(waiting.every((row) => row.endpoint === "plants+harvests" && row.message === FACILITIES_UNCHECKED_WORDS && row.calls === 0)).toBe(true);
    // Sweep now (Phase D): one license and endpoint, a call cap, no retention.
    const only = fakeApi({});
    const result = await runMirrorSweep({ DB: m.db, ...KEYS, METRC_API_BASE: PROD }, "admin", { fetchImpl: only.fetchImpl, now: () => LATER, clock: () => 0, only: { license: PROCESSOR, endpoint: PACKAGES_ACTIVE }, calls: 3 });
    expect(result).toMatchObject({ status: "ok", runs: 1 });
    expect(only.calls.every((call) => call.license === PROCESSOR && call.path === PACKAGES_ACTIVE)).toBe(true);
  });

  it("the 45-past cron routes to the mirror sweep in its own waitUntil; the 15-past path is unchanged", async () => {
    expect(MIRROR_CRON).toBe("45 * * * *");
    expect(isMirrorCron("45 * * * *")).toBe(true);
    expect(isMirrorCron("15 * * * *")).toBe(false);
    expect(isMirrorCron("*/5 * * * *")).toBe(false);
    expect(isMirrorCron("")).toBe(false);
    const m = await migratedDb();
    const env = { DB: m.db, THEME: "grip" } as unknown as Env;
    const waited: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => waited.push(p), passThroughOnException: () => undefined } as unknown as ExecutionContext;
    await worker.scheduled({ cron: "45 * * * *", scheduledTime: Date.now(), noRetry: () => undefined } as ScheduledController, env, ctx);
    expect(waited).toHaveLength(1);
    expect(m.all(`SELECT status, license_value FROM metrc_sweep_runs`)).toEqual([{ status: "skipped", license_value: "*" }]);
    expect(m.all(`SELECT * FROM metrc_sweeps`)).toHaveLength(0);
    await worker.scheduled({ cron: "15 * * * *", scheduledTime: Date.now(), noRetry: () => undefined } as ScheduledController, env, ctx);
    expect(waited).toHaveLength(2);
    expect(m.all(`SELECT status FROM metrc_sweeps`)).toEqual([{ status: "skipped" }]);
    expect(m.all(`SELECT * FROM metrc_sweep_runs`)).toHaveLength(1);
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(0);
  });

  it("A30: retention prunes the call, sweep and run logs older than the keep days in pages, at most ten statements a tick, samples with their runs", async () => {
    const m = await migratedDb();
    const old = "2026-06-01T00:00:00.000Z";
    for (let i = 0; i < 1200; i += 1) await recordMetrcCall(m.db, { started_at: old, path: `/old/${i}`, status: 200, ms: 1 }, PROD_HOST);
    for (let i = 0; i < 10; i += 1) await recordMetrcCall(m.db, { started_at: "2026-10-08T09:00:00.000Z", path: `/new/${i}`, status: 200, ms: 1 }, PROD_HOST);
    for (let i = 0; i < 3; i += 1) {
      m.run(`INSERT INTO metrc_sweep_runs (id, host, license_value, endpoint, kind, mode, run_kind, trigger, started_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'packages', 'dry_run', 'full', 'cron', ?, 'ok', ?, ?)`, `run-${i}`, PROD_HOST, GROW, PACKAGES_ACTIVE, old, old, old);
      for (let s = 0; s < 20; s += 1) m.run(`INSERT INTO metrc_sweep_samples (id, run_id, tag, column_name, created_at) VALUES (?, ?, 'T', 'c', ?)`, `s-${i}-${s}`, `run-${i}`, old);
    }
    m.run(`INSERT INTO metrc_sweep_runs (id, host, license_value, endpoint, kind, mode, run_kind, trigger, started_at, status, created_at, updated_at) VALUES ('run-new', ?, ?, ?, 'packages', 'dry_run', 'full', 'cron', ?, 'ok', ?, ?)`, PROD_HOST, GROW, PACKAGES_ACTIVE, NOW, NOW, NOW);
    m.run(`INSERT INTO metrc_sweep_samples (id, run_id, tag, column_name, created_at) VALUES ('s-new', 'run-new', 'T', 'c', ?)`, NOW);
    for (let i = 0; i < 2; i += 1) m.run(`INSERT INTO metrc_sweeps (id, started_at, status, trigger) VALUES (?, ?, 'skipped', 'cron')`, `sweep-${i}`, old);
    m.run(`INSERT INTO metrc_sweeps (id, started_at, status, trigger) VALUES ('sweep-new', ?, 'skipped', 'cron')`, NOW);
    // Three statements: the samples page, the runs page, the sweeps page; the calls wait for the next tick.
    expect(await pruneMetrcLogs(m.db, 90, NOW, 3, 500)).toEqual({ statements: 3, deleted: 65 });
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(1210);
    expect(m.all(`SELECT id FROM metrc_sweep_runs`)).toEqual([{ id: "run-new" }]);
    expect(m.all(`SELECT id FROM metrc_sweep_samples`)).toEqual([{ id: "s-new" }]);
    expect(m.all(`SELECT id FROM metrc_sweeps`)).toEqual([{ id: "sweep-new" }]);
    // The next tick: 500, 500 and 200 calls in three statements, then nothing is left.
    expect(await pruneMetrcLogs(m.db, 90, NOW, 10, 500)).toEqual({ statements: 6, deleted: 1200 });
    expect(m.all(`SELECT * FROM metrc_api_calls`)).toHaveLength(10);
    expect(await pruneMetrcLogs(m.db, 90, NOW, 10, 500)).toEqual({ statements: 4, deleted: 0 });
    // A cron tick prunes at its end; an admin run does not.
    for (let i = 0; i < 5; i += 1) await recordMetrcCall(m.db, { started_at: old, path: `/old2/${i}`, status: 200, ms: 1 }, PROD_HOST);
    const api = fakeApi({});
    await runMirrorSweep({ DB: m.db, METRC_API_BASE: PROD }, "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(m.all(`SELECT * FROM metrc_api_calls WHERE started_at = ?`, old)).toHaveLength(5);
    await runMirrorSweep({ DB: m.db, METRC_API_BASE: PROD }, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(m.all(`SELECT * FROM metrc_api_calls WHERE started_at = ?`, old)).toHaveLength(0);
  });
});

/* ------------------------------------------------ the Phase C fix pass */

describe("MA1 Phase C fix pass: the mass-gone guard (A29) end to end", () => {
  it("the 0-rows arm reads the full pass's own count: an empty active list is held although the onhold list filled the tick's seen set", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedMirror(m, { tag: tag(1), license: PROCESSOR });
    seedMirror(m, { tag: tag(2), license: PROCESSOR });
    // The active list answers nothing (a permission, a glitch); the onhold list carries one of the two (packages on hold count as seen only).
    const api = fakeApi({ [ONHOLD_ENDPOINTS.packages]: (call) => (call.license === PROCESSOR ? [pkg(tag(1), { IsOnHold: true })] : []) });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: PROCESSOR_PACKAGES });
    expect(runs(m)).toEqual([expect.objectContaining({ status: "ok", pages: 2, rows: 1, would_gone: 1, gone_held: 1, message: GONE_HELD_WORDS })]);
    expect(m.all(`SELECT gone_at FROM metrc_packages WHERE license_value = ?`, PROCESSOR).every((row) => row.gone_at == null)).toBe(true);
  });

  it("with metrc_gone_hold_share 1, a pass that reads 0 rows against live rows is still held", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    m.run(`UPDATE app_config SET value = '1' WHERE key = 'metrc_gone_hold_share'`);
    seedGrowOnly(m, PROD_HOST);
    seedMirror(m, { tag: tag(1), license: PROCESSOR });
    seedMirror(m, { tag: tag(2), license: PROCESSOR });
    const api = fakeApi({});
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: PROCESSOR_PACKAGES });
    expect(runs(m)).toEqual([expect.objectContaining({ status: "ok", would_gone: 2, gone_held: 1, message: GONE_HELD_WORDS })]);
    expect(m.all(`SELECT gone_at FROM metrc_packages WHERE license_value = ?`, PROCESSOR).every((row) => row.gone_at == null)).toBe(true);
  });

  it("the override is consumed by the next complete pass whether or not the guard would have held, so a later empty read is held again", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    for (const n of [1, 2, 3, 4]) seedMirror(m, { tag: tag(n), license: PROCESSOR });
    let active: Record<string, unknown>[] = [];
    const api = fakeApi({ [PACKAGES_ACTIVE]: (call) => (call.license === PROCESSOR && !call.start ? active : []) });
    const env = prodEnv(m);
    // Tick 1: Metrc answers nothing: held. Dennis confirms on the Admin page (Phase D) by setting the override.
    await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: PROCESSOR_PACKAGES });
    expect(fullRuns(m)[0]).toMatchObject({ would_gone: 4, gone_held: 1 });
    const cursor = await loadCursor(m.db, { host: PROD_HOST, license: PROCESSOR, endpoint: PACKAGES_ACTIVE, mode: "write", kind: "packages", phase: null });
    m.run(`UPDATE metrc_cursors SET gone_override = 1 WHERE id = ?`, String(cursor?.id));
    // Tick 2, the next day: a clean pass under the share marks the one missing row and consumes the override.
    active = [pkg(tag(1)), pkg(tag(2)), pkg(tag(3))];
    await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => NEXT_DAY, clock: () => 0, only: PROCESSOR_PACKAGES });
    expect(fullRuns(m)[1]).toMatchObject({ would_gone: 1, gone_held: 0 });
    expect(m.get(`SELECT gone_at FROM metrc_packages WHERE tag = ?`, tag(4))).toEqual({ gone_at: NEXT_DAY });
    expect(m.get(`SELECT gone_override FROM metrc_cursors WHERE id = ?`, String(cursor?.id))).toEqual({ gone_override: 0 });
    // Tick 3, a day later: Metrc glitches to nothing again: held, the three live rows stay, nothing closes.
    active = [];
    await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => DAY_3, clock: () => 0, only: PROCESSOR_PACKAGES });
    expect(fullRuns(m)[2]).toMatchObject({ would_gone: 3, gone_held: 1, message: GONE_HELD_WORDS });
    expect(m.all(`SELECT tag FROM metrc_packages WHERE license_value = ? AND gone_at IS NULL ORDER BY tag`, PROCESSOR).map((row) => row.tag)).toEqual([tag(1), tag(2), tag(3)]);
  });
});

describe("MA1 Phase C fix pass: the seen set across the ticks of a full pass", () => {
  it("a label Metrc sends in another case on an earlier tick's page counts as seen when the pass completes", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedMirror(m, { tag: tag(1), license: PROCESSOR, location: "Barn", grams: 750.5 });
    seedMirror(m, { tag: tag(2), license: PROCESSOR, location: "Barn", grams: 750.5 });
    const api = fakeApi({
      [PACKAGES_ACTIVE]: (call) => (call.license !== PROCESSOR ? [] : call.page === 1 ? envelope([pkg(tag(1).toLowerCase())], 1, 2) : envelope([pkg(tag(2))], 2, 2)),
    });
    const env = prodEnv(m);
    // Tick 1 reads page 1 only: its lower-case label is kept upper-cased, like the mirror's tag; the row read unchanged keeps its old stamps.
    const tick1 = await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: PROCESSOR_PACKAGES, calls: 1 });
    expect(tick1.calls).toBe(1);
    expect(fullRuns(m)[0]).toMatchObject({ status: "budget", pages: 1, rows: 1 });
    expect(m.all(`SELECT tags_json FROM metrc_pass_pages`).map((row) => JSON.parse(String(row.tags_json)))).toEqual([[tag(1)]]);
    expect(m.get(`SELECT changed_at FROM metrc_packages WHERE tag = ?`, tag(1))).toEqual({ changed_at: T0 });
    // Tick 2 completes the pass: the row is on the API list, so it is never gone.
    const tick2 = await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => LATER, clock: () => 0, only: PROCESSOR_PACKAGES, calls: 10 });
    expect(tick2.status).toBe("ok");
    expect(fullRuns(m)[1]).toMatchObject({ status: "ok", would_gone: 0, gone_held: 0 });
    expect(m.all(`SELECT tag, gone_at FROM metrc_packages WHERE license_value = ? ORDER BY tag`, PROCESSOR)).toEqual([
      { tag: tag(1), gone_at: null },
      { tag: tag(2), gone_at: null },
    ]);
  });

  it("a row first seen after the pass began, and not on its pages, is never gone when the pass completes next tick", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    const pageOne = Array.from({ length: 51 }, (_, i) => pkg(tag(i + 1)));
    const api = fakeApi({ [PACKAGES_ACTIVE]: (call) => (call.license !== GROW ? [] : call.page === 1 ? pageOne : [pkg(tag(52))]) });
    const env = prodEnv(m);
    const tick1 = await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_PACKAGES, calls: 1 });
    expect(tick1.calls).toBe(1);
    expect(runs(m)[0]).toMatchObject({ run_kind: "full", status: "budget", pages: 1, rows: 51 });
    // Between the ticks a row lands (the file door, say): first seen after the pass began.
    m.run(
      `INSERT INTO metrc_packages (tag, license_value, location, item, quantity, uom, lab_test_status, mount_id, first_seen_at, changed_at) VALUES (?, ?, 'Barn', 'WPR', 1, 'g', 'TestPassed', 'mount-file', ?, ?)`,
      tag(99),
      GROW,
      "2026-10-08T11:00:00.000Z",
      "2026-10-08T11:00:00.000Z"
    );
    const tick2 = await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => LATER, clock: () => 0, only: GROW_PACKAGES, calls: 10 });
    expect(tick2.status).toBe("ok");
    expect(runs(m)[1]).toMatchObject({ run_kind: "full", status: "ok", would_gone: 0, gone_held: 0 });
    expect(m.get(`SELECT gone_at FROM metrc_packages WHERE tag = ?`, tag(99))).toEqual({ gone_at: null });
    expect(m.all(`SELECT COUNT(*) AS n FROM metrc_packages WHERE license_value = ? AND gone_at IS NULL`, GROW)[0].n).toBe(53);
  });

  it("the harvests read on an earlier tick's pages are seen when the pass completes (the Id is the key)", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    const pageOne = Array.from({ length: 51 }, (_, i) => harvest(i + 1, `H${i + 1}`));
    const api = fakeApi({ [HARVESTS_ACTIVE]: (call) => (call.license !== GROW ? [] : call.page === 1 ? pageOne : [harvest(52, "H52")]) });
    const env = prodEnv(m);
    await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_HARVESTS, calls: 1 });
    expect(m.all(`SELECT tags_json FROM metrc_pass_pages`).map((row) => (JSON.parse(String(row.tags_json)) as string[]).length)).toEqual([51]);
    await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => LATER, clock: () => 0, only: GROW_HARVESTS, calls: 10 });
    expect(runs(m)[1]).toMatchObject({ run_kind: "full", status: "ok", would_gone: 0, gone_held: 0 });
    expect(m.all(`SELECT COUNT(*) AS n FROM metrc_harvests WHERE gone_at IS NULL`)[0].n).toBe(52);
  });
});

describe("MA1 Phase C fix pass: harvests", () => {
  it("an inactive harvest the mirror holds is never judged gone by the active pass that does not carry it", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedHarvest(m, 3, "H3", GROW, "active");
    seedHarvest(m, 4, "H4", GROW, "active");
    seedHarvest(m, 20, "H20", GROW, "inactive", { finished_date: "2025-01-10" });
    const api = fakeApi({ [HARVESTS_ACTIVE]: (call) => (call.license === GROW ? [harvest(3, "H3"), harvest(4, "H4")] : []) });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_HARVESTS });
    expect(m.get(`SELECT state, gone_at FROM metrc_harvests WHERE harvest_id = 20`)).toEqual({ state: "inactive", gone_at: null });
    expect(runs(m)).toEqual([expect.objectContaining({ endpoint: HARVESTS_ACTIVE, status: "ok", would_gone: 0, gone_held: 0 })]);
  });

  it("a harvest marked gone that returns on the active list is an update that clears its gone mark", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    for (const id of [1, 2, 3, 4]) seedHarvest(m, id, `H${id}`, GROW, "active");
    m.run(`UPDATE metrc_harvests SET gone_at = ?, gone_mount_id = 'mount-0' WHERE harvest_id = 3`, "2026-10-01T00:00:00.000Z");
    const api = fakeApi({ [HARVESTS_ACTIVE]: (call) => (call.license === GROW ? [1, 2, 3, 4].map((id) => harvest(id, `H${id}`)) : []) });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_HARVESTS });
    expect(m.get(`SELECT state, gone_at, gone_mount_id, changed_at FROM metrc_harvests WHERE harvest_id = 3`)).toEqual({ state: "active", gone_at: null, gone_mount_id: null, changed_at: NOW });
    expect(runs(m)).toEqual([expect.objectContaining({ would_add: 0, would_update: 1, would_gone: 0 })]);
  });

  it("a harvest only on the onhold list takes state onhold (an update), never gone", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedHarvest(m, 3, "H3", GROW, "active");
    seedHarvest(m, 5, "H5", GROW, "active");
    const api = fakeApi({
      [HARVESTS_ACTIVE]: (call) => (call.license === GROW ? [harvest(3, "H3")] : []),
      [ONHOLD_ENDPOINTS.harvests]: (call) => (call.license === GROW ? [harvest(5, "H5")] : []),
    });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_HARVESTS });
    expect(m.all(`SELECT harvest_id, state, gone_at FROM metrc_harvests ORDER BY harvest_id`)).toEqual([
      { harvest_id: 3, state: "active", gone_at: null },
      { harvest_id: 5, state: "onhold", gone_at: null },
    ]);
    expect(runs(m)).toEqual([expect.objectContaining({ would_update: 1, would_gone: 0 })]);
  });

  it("a key delivered twice in one tick (the active list and the onhold list) is reconciled once, the first delivery winning (deviation 7, for ruling)", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedHarvest(m, 3, "H3", GROW, "active");
    const api = fakeApi({
      [HARVESTS_ACTIVE]: (call) => (call.license === GROW ? [harvest(3, "H3")] : []),
      [ONHOLD_ENDPOINTS.harvests]: (call) => (call.license === GROW ? [harvest(3, "H3")] : []),
    });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_HARVESTS });
    expect(m.get(`SELECT state, changed_at FROM metrc_harvests WHERE harvest_id = 3`)).toEqual({ state: "active", changed_at: T0 });
    expect(runs(m)).toEqual([expect.objectContaining({ would_add: 0, would_update: 0, would_gone: 0 })]);
  });
});

describe("MA1 Phase C fix pass: the onhold list in the complete pass (A10)", () => {
  it("a package on the onhold list and absent from the active list is seen, never gone", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    for (const n of [1, 2, 3]) seedMirror(m, { tag: tag(n), license: GROW });
    const api = fakeApi({
      [PACKAGES_ACTIVE]: (call) => (call.license === GROW ? [pkg(tag(1)), pkg(tag(2))] : []),
      [ONHOLD_ENDPOINTS.packages]: (call) => (call.license === GROW ? [pkg(tag(3), { IsOnHold: true })] : []),
    });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_PACKAGES });
    expect(m.get(`SELECT gone_at FROM metrc_packages WHERE tag = ?`, tag(3))).toEqual({ gone_at: null });
    expect(runs(m)).toEqual([expect.objectContaining({ status: "ok", would_gone: 0, gone_held: 0 })]);
  });

  it("an onhold list that cannot be read whole keeps the pass open: nothing gone, the run row says why, the cursor still holds the pass", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    for (const n of [1, 2, 3]) seedMirror(m, { tag: tag(n), license: GROW });
    const api = fakeApi({
      [PACKAGES_ACTIVE]: (call) => (call.license === GROW ? [pkg(tag(1)), pkg(tag(2))] : []),
      [ONHOLD_ENDPOINTS.packages]: () => new Response("down", { status: 500 }),
    });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_PACKAGES });
    expect(m.all(`SELECT gone_at FROM metrc_packages WHERE license_value = ?`, GROW).every((row) => row.gone_at == null)).toBe(true);
    const row = runs(m)[0];
    expect(row).toMatchObject({ status: "failed", failures: 1, would_gone: 0, gone_held: 0 });
    expect(String(row.message)).toContain(ONHOLD_INCOMPLETE_WORDS);
    const cursor = await loadCursor(m.db, { host: PROD_HOST, license: GROW, endpoint: PACKAGES_ACTIVE, mode: "write", kind: "packages", phase: null });
    expect(cursor?.full_pass_id).not.toBeNull();
    expect(cursor?.full_completed_at).toBeNull();
  });

  it("an onhold plant counts as seen only within the phase its GrowthPhase names", async () => {
    const run = async (growthPhase: "Vegetative" | "Flowering") => {
      const m = await migratedDb();
      setMode(m, "write");
      seedGrowOnly(m, PROD_HOST);
      seedPlant(m, "1A4050000000000000000F01", GROW, "flowering");
      seedPlant(m, "1A4050000000000000000X01", GROW, "flowering");
      const api = fakeApi({
        [PLANTS_FLOWERING]: (call) => (call.license === GROW ? [plant("1A4050000000000000000F01", "Flowering")] : []),
        [ONHOLD_ENDPOINTS.plants]: (call) => (call.license === GROW ? [plant("1A4050000000000000000X01", growthPhase, { IsOnHold: true })] : []),
      });
      await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: { license: GROW, endpoint: PLANTS_FLOWERING } });
      return { gone: m.get(`SELECT gone_at FROM metrc_plants WHERE tag = '1A4050000000000000000X01'`)?.gone_at ?? null, row: runs(m)[0] };
    };
    const held = await run("Flowering");
    expect(held.gone).toBeNull();
    expect(held.row).toMatchObject({ would_gone: 0, gone_held: 0 });
    const elsewhere = await run("Vegetative");
    expect(elsewhere.gone).toBe(NOW);
    expect(elsewhere.row).toMatchObject({ would_gone: 1, gone_held: 0 });
  });
});

describe("MA1 Phase C fix pass: what follows a packages pass", () => {
  it("an incremental whose lab status moved releases the Testing Queue package, with actor null and the mount in the reason", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    seedGrowOnly(m, PROD_HOST);
    seedMirror(m, { tag: tag(1), license: GROW, status: "TestPassed" });
    seedMirror(m, { tag: tag(2), license: GROW, status: "SubmittedForTesting" });
    m.run(
      `INSERT INTO wip_packages (id, package_code, package_type_code, weight_grams, status, source, created_at, updated_at) VALUES ('q1', ?, 'BUD', 448, 'testing_queue', 'trim', ?, ?)`,
      tag(2),
      T0,
      T0
    );
    let incrementalRows: Record<string, unknown>[] = [];
    const api = fakeApi({
      [PACKAGES_ACTIVE]: (call) => (call.license !== GROW ? [] : call.start ? incrementalRows : [pkg(tag(1)), pkg(tag(2), { LabTestingState: "SubmittedForTesting" })]),
    });
    const env = prodEnv(m);
    await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_PACKAGES });
    // The complete pass moved no lab status: the queue package waits.
    expect(m.get(`SELECT status FROM wip_packages WHERE id = 'q1'`)).toEqual({ status: "testing_queue" });
    incrementalRows = [pkg(tag(2), { LabTestingState: "TestPassed" })];
    await runMirrorSweep(env, "admin", { fetchImpl: api.fetchImpl, now: () => LATER, clock: () => 0, only: GROW_PACKAGES });
    expect(m.get(`SELECT status, test_outcome FROM wip_packages WHERE id = 'q1'`)).toEqual({ status: "released", test_outcome: "passed" });
    const mountId = String(m.get(`SELECT id FROM metrc_mounts WHERE source = 'api'`)?.id);
    const logs = m.all(`SELECT field, new_value, actor_person_id, reason FROM record_change_log WHERE record_table = 'wip_packages' AND record_id = 'q1' ORDER BY field`);
    expect(logs).toEqual([
      { field: "status", new_value: "released", actor_person_id: null, reason: `metrc mirror: TestPassed (mount ${mountId.replaceAll("-", "").slice(0, 8)})` },
      { field: "test_outcome", new_value: "passed", actor_person_id: null, reason: `metrc mirror: TestPassed (mount ${mountId.replaceAll("-", "").slice(0, 8)})` },
    ]);
    expect(runs(m).filter((row) => row.run_kind === "incremental")).toEqual([expect.objectContaining({ would_update: 1, would_gone: 0 })]);
  });

  it("internal_field_values on a tag the pass marks gone are untouched", async () => {
    const m = await migratedDb();
    setMode(m, "write");
    for (const n of [1, 2, 3]) seedMirror(m, { tag: tag(n), license: GROW });
    m.run(
      `INSERT INTO internal_field_values (id, tag, field_key, value, created_at, created_by, updated_at, updated_by) VALUES ('f3', ?, 'notes', 'keep me', ?, 'person-1', ?, 'person-1')`,
      tag(3),
      T0,
      T0
    );
    const before = dump(m, "internal_field_values", "id");
    const api = fakeApi({ [PACKAGES_ACTIVE]: (call) => (call.license === GROW ? [pkg(tag(1)), pkg(tag(2))] : []) });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: GROW_PACKAGES });
    expect(m.get(`SELECT gone_at FROM metrc_packages WHERE tag = ?`, tag(3))).toEqual({ gone_at: NOW });
    expect(dump(m, "internal_field_values", "id")).toBe(before);
  });
});

describe("MA1 Phase C fix pass: the budget, the pace and the run row", () => {
  it("a list that answers 500 ends its run row failed with failures 1", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    const api = fakeApi({ [PACKAGES_ACTIVE]: (call) => (call.license === PROCESSOR ? new Response("down", { status: 500 }) : []) });
    await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: PROCESSOR_PACKAGES });
    expect(runs(m)).toEqual([expect.objectContaining({ status: "failed", failures: 1, calls: 1, pages: 0 })]);
  });

  it("the month pace counts this host's calls only: another host's month does not slow the tick", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    // 8000 calls over the 566 ticks left in the month pace this tick to 14 calls, exactly the 7 packages scopes' page and onhold reads;
    // 100 calls already spent this month on the other host would pace it to 13 and starve the last scope if they were counted.
    m.run(`UPDATE app_config SET value = '8000' WHERE key = 'metrc_month_calls'`);
    for (let i = 0; i < 100; i += 1) await recordMetrcCall(m.db, { started_at: "2026-10-02T00:00:00.000Z", path: `/sandbox/${i}`, status: 200, ms: 1 }, SANDBOX_HOST);
    const api = fakeApi({});
    const result = await runMirrorSweep(prodEnv(m), "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(result).toMatchObject({ status: "ok", runs: 7, calls: 14 });
    expect(runs(m).filter((row) => row.endpoint === PACKAGES_ACTIVE).every((row) => row.status === "ok" && row.calls === 2)).toBe(true);
  });

  it("Sweep now's call cap bounds the tick: one call, and the pass cannot complete", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    const api = fakeApi({});
    const result = await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, only: PROCESSOR_PACKAGES, calls: 1 });
    expect(api.calls).toHaveLength(1);
    expect(result.calls).toBe(1);
    expect(runs(m)[0].status).not.toBe("ok");
  });

  it("Sweep now's call cap holds only as a finite number: NaN keeps the paced budget and the tick's cap", async () => {
    const m = await migratedDb();
    setMode(m, "dry_run");
    // Every license's list is 40 pages long; the per-license cap (20) alone would allow 140 calls against the tick's 60.
    const api = fakeApi({ [PACKAGES_ACTIVE]: (call) => envelope(Array.from({ length: 10 }, (_, i) => pkg(tag(call.page * 100 + i))), call.page, 40) });
    const result = await runMirrorSweep(prodEnv(m), "admin", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0, calls: Number("abc") });
    expect(result.calls).toBe(60);
    expect(api.calls).toHaveLength(60);
  });
});

describe("MA1 Phase C fix pass: retention", () => {
  it("the cron tick's prune leaves record_change_log alone however old its rows", async () => {
    const m = await migratedDb();
    const old = "2026-06-01T00:00:00.000Z";
    m.run(
      `INSERT INTO record_change_log (id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at) VALUES ('log-old', 'metrc_mounts', 'm0', 'rows_added', NULL, '1', NULL, 'metrc mount', ?)`,
      old
    );
    m.run(`INSERT INTO metrc_sweeps (id, started_at, status, trigger) VALUES ('sweep-old', ?, 'skipped', 'cron')`, old);
    const api = fakeApi({});
    await runMirrorSweep({ DB: m.db, METRC_API_BASE: PROD }, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(m.all(`SELECT id FROM metrc_sweeps WHERE id = 'sweep-old'`)).toHaveLength(0);
    expect(m.all(`SELECT id FROM record_change_log WHERE id = 'log-old'`)).toEqual([{ id: "log-old" }]);
  });

  it("keeps at least 31 days of the call log whatever metrc_log_keep_days says, so the month pace (A18) keeps every call of the month", async () => {
    const m = await migratedDb();
    expect(METRC_LOG_KEEP_FLOOR_DAYS).toBe(31);
    m.run(`UPDATE app_config SET value = '1' WHERE key = 'metrc_log_keep_days'`);
    for (let i = 0; i < 40; i += 1) await recordMetrcCall(m.db, { started_at: "2026-10-03T00:00:00.000Z", path: `/five-days/${i}`, status: 200, ms: 1 }, PROD_HOST);
    await recordMetrcCall(m.db, { started_at: "2026-08-29T00:00:00.000Z", path: "/forty-days", status: 200, ms: 1 }, PROD_HOST);
    expect(await callsThisMonth(m.db, NOW, PROD_HOST)).toBe(40);
    const api = fakeApi({});
    await runMirrorSweep({ DB: m.db, METRC_API_BASE: PROD }, "cron", { fetchImpl: api.fetchImpl, now: () => NOW, clock: () => 0 });
    expect(await callsThisMonth(m.db, NOW, PROD_HOST)).toBe(40);
    expect(m.all(`SELECT path FROM metrc_api_calls WHERE path = '/forty-days'`)).toHaveLength(0);
    expect(await pruneMetrcLogs(m.db, 1, NOW)).toEqual({ statements: 4, deleted: 0 });
  });
});
