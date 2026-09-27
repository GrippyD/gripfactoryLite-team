import { describe, expect, it } from "vitest";
import { addLotWeight, finishUnload, loadSilo, pauseSiloLoad, scheduleLogisticsLot, startSiloLoad, unloadTogether } from "../src/actions";
import { nowIso } from "../src/audit";
import { dryingReturnPath, LOC_ARL_BARN, LOC_BARN, shortLotId, SYSTEM_REASON } from "../src/config";
import { listDryingComplete, type BarnWetLotRow, type DryingCompleteRow, type SiloLoadRow, type SiloRow } from "../src/db";
import { loadSiloPage } from "../src/drying";
import { app } from "../src/index";
import { jointUnloadShares } from "../src/ledger";
import { stationByKey } from "../src/pipeline";
import {
  canUnloadTogether,
  dryingCompleteSince,
  dryingLoadHref,
  dryingSchedulingPage,
  dryingYieldPct,
  parseDryingStage,
  parseScheduleStage,
  plannedSpaceIdOf,
  unloadDayOf,
  type DryingSurfaceInput,
} from "../src/scheduling";
import { formOf, migratedDb, seedBatch, seedPerson, type MigratedDb } from "./migrated";

const NOW = "2026-09-25T16:00:00.000Z";

const SPACES: SiloRow[] = [
  { id: "s1", name: "Silo 1", farm_code: "PNN", space_type: "silo" },
  { id: "s2", name: "Silo 2", farm_code: "PNN", space_type: "silo" },
  { id: "arl", name: "Arlington Dry Room", farm_code: "ARL", space_type: "dry_room" },
  { id: "bf", name: "Blast Freezer(s)", farm_code: "PNN", space_type: "freezer", location_name: "Blast Freezer" },
];

function lot(over: Partial<BarnWetLotRow> = {}): BarnWetLotRow {
  return {
    id: "lot1",
    status: "drying",
    barn_location: "BARN",
    hbn: "26251-ARL-GH-027-0-NA-26011",
    metrc_harvest_tag: null,
    farm_code: "ARL",
    truck_number: null,
    strain_label: "Fruity Pebbles",
    entry_date: "2026-09-08",
    weight_grams: 1500,
    material_form: "bucked",
    actual_dryspc: "s2",
    planned_space_name: "Silo 2",
    planned_space_kind: "silo",
    planned_silo_id: null,
    package_code: "26011",
    item_id: "i1",
    lead_name: null,
    supervisor_name: null,
    notes: null,
    plant_count: 12,
    ...over,
  };
}

function load(over: Partial<SiloLoadRow> = {}): SiloLoadRow {
  return {
    id: "L1",
    dry_space_id: "s1",
    silo_name: "Silo 1",
    wet_weight_entry_id: "lotA",
    hbn: "26251-PNN-GH-001-0-NA-26021",
    metrc_harvest_tag: null,
    strain_label: "After Party",
    farm_code: "PNN",
    weight_grams: 1000,
    dry_weight_grams: null,
    loaded_at: "2026-09-25T12:00:00.000Z",
    started_at: "2026-09-25T12:00:00.000Z",
    paused_at: null,
    paused_seconds: 0,
    ended_at: null,
    notes: null,
    truck_number: null,
    ...over,
  };
}

function done(over: Partial<DryingCompleteRow> = {}): DryingCompleteRow {
  return {
    lot_id: "lotD",
    status: "unloaded",
    truck_number: null,
    weight_grams: 1240,
    dry_weight_grams: 752,
    space_id: "s1",
    space_name: "Silo 1",
    space_type: "silo",
    shape: "cylinder",
    hbn: "26251-PNN-GH-001-0-NA-26031",
    metrc_harvest_tag: null,
    farm_code: "PNN",
    strain_label: "After Party",
    package_code: "26031",
    finished_at: "2026-09-25T14:00:00.000Z",
    effective_date: "2026-09-25",
    ended_at: "2026-09-25T14:00:00.000Z",
    ...over,
  };
}

function live(loads: SiloLoadRow[]): DryingSurfaceInput["live"] {
  return SPACES.map((silo) => ({ silo, loads: loads.filter((l) => l.dry_space_id === silo.id) }));
}

function page(stage: DryingSurfaceInput["stage"], over: Partial<DryingSurfaceInput> = {}): string {
  return dryingSchedulingPage({ stage, lots: [], live: live([]), complete: [], nowIso: NOW, ...over });
}

function pane(html: string, name: "available" | "working" | "complete"): string {
  const at = html.indexOf(`data-schedule-pane="${name}"`);
  if (at === -1) return "";
  const rest = html.slice(at + 10);
  const next = rest.search(/data-schedule-pane="/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("THE DRYING SCHEDULE: the stages (canon 0.30.226)", () => {
  it("three drying surfaces answer; none is a line, and only their own paths are a return", () => {
    expect(parseDryingStage("silos")).toBe("silos");
    expect(parseDryingStage("dry_rooms")).toBe("dry_rooms");
    expect(parseDryingStage("freezers")).toBe("freezers");
    expect(parseDryingStage("trim")).toBeNull();
    expect(parseDryingStage(undefined)).toBeNull();
    expect(parseScheduleStage("silos")).toBeNull();
    expect(parseScheduleStage("freezers")).toBeNull();
    expect(dryingReturnPath("/production/scheduling/dry_rooms")).toBe("/production/scheduling/dry_rooms");
    expect(dryingReturnPath(" /production/scheduling/silos ")).toBe("/production/scheduling/silos");
    expect(dryingReturnPath("/production/scheduling/trim")).toBeNull();
    expect(dryingReturnPath("/production/scheduling/silos?ok=x")).toBeNull();
    expect(dryingReturnPath("//evil.example/production/scheduling/silos")).toBeNull();
    expect(dryingReturnPath(null)).toBeNull();
  });
});

describe("THE DRYING SCHEDULE: the three surfaces (canon 0.30.226)", () => {
  it("three panes, each EMPTY when nothing is on them, the title by kind", () => {
    for (const [stage, title] of [
      ["silos", "Silos"],
      ["dry_rooms", "Dry Rooms"],
      ["freezers", "Freezers"],
    ] as const) {
      const html = page(stage);
      expect(html).toContain(`<h1>${title}</h1>`);
      expect(html).toContain('class="station-triple"');
      expect(html).toContain('data-schedule-pane="available"');
      expect(html).toContain('data-schedule-pane="working"');
      expect(html).toContain('data-schedule-pane="complete"');
      expect((html.match(/- EMPTY -/g) || []).length).toBe(3);
      expect(html).toContain(">Working <");
    }
    const es = page("dry_rooms", { locale: "es" });
    expect(es).toContain("<h1>Cuartos de secado</h1>");
    expect(es).toContain("Disponible");
    expect(es).toContain("En trabajo");
    expect(es).toContain("Completado");
  });

  it("Available: every waiting lot on every surface, planned here only on its own kind, grouped by HBN", () => {
    const silo = lot();
    const room = lot({ id: "lot2", hbn: "26251-ARL-GH-027-0-NA-26012", actual_dryspc: "arl", planned_space_name: "Arlington Dry Room" });
    const truck = lot({ id: "lot3", truck_number: "3", actual_dryspc: "s1", planned_space_name: "Silo 1" });
    const lots = [silo, room, truck];
    const silos = pane(page("silos", { lots, live: live([]) }), "available");
    expect(silos).toContain('data-schedule-count="available">3<');
    expect(silos).toContain('<h3 class="schedule-hbn-label">26251-ARL-GH-027-0-NA-26011 <span class="tile-count">2</span></h3>');
    const siloRow = silos.slice(silos.indexOf('data-drying-lot="lot1"'), silos.indexOf("</li>", silos.indexOf('data-drying-lot="lot1"')));
    expect(siloRow).toContain("data-planned-here");
    expect(siloRow).toContain("Silo 2");
    expect(siloRow).toContain("Wet 1,500 g");
    expect(siloRow).toContain('href="/station/load_silo?pick=lot1&amp;kind=silo&amp;space=s2"');
    expect(siloRow).toContain("&gt;&gt;");
    expect(silos).toContain("Truck 3 - 26251-ARL-GH-027-0-NA-26011");
    const roomOnSilos = silos.slice(silos.indexOf('data-drying-lot="lot2"'), silos.indexOf("</li>", silos.indexOf('data-drying-lot="lot2"')));
    expect(roomOnSilos).not.toContain("data-planned-here");
    expect(roomOnSilos).toContain("Planned: Arlington Dry Room");
    expect(roomOnSilos).toContain('href="/station/load_silo?pick=lot2&amp;kind=silo"');

    const rooms = pane(page("dry_rooms", { lots, live: live([]) }), "available");
    const siloOnRooms = rooms.slice(rooms.indexOf('data-drying-lot="lot1"'), rooms.indexOf("</li>", rooms.indexOf('data-drying-lot="lot1"')));
    expect(siloOnRooms).not.toContain("data-planned-here");
    expect(siloOnRooms).toContain("Planned: Silo 2");
    expect(siloOnRooms).toContain('href="/station/load_silo?pick=lot1&amp;kind=dry_room"');
    const roomOnRooms = rooms.slice(rooms.indexOf('data-drying-lot="lot2"'), rooms.indexOf("</li>", rooms.indexOf('data-drying-lot="lot2"')));
    expect(roomOnRooms).toContain("data-planned-here");
    expect(roomOnRooms).toContain('href="/station/load_silo?pick=lot2&amp;kind=dry_room&amp;space=arl"');
  });

  it("the planned space is the lot's own loadable space, else the HBN's planned silo", () => {
    expect(plannedSpaceIdOf(lot())).toBe("s2");
    const truckLot = lot({ actual_dryspc: "truck-sentinel", planned_space_kind: "truck", planned_silo_id: "s1" });
    expect(plannedSpaceIdOf(truckLot)).toBe("s1");
    expect(dryingLoadHref(truckLot, "silo", SPACES)).toBe("/station/load_silo?pick=lot1&kind=silo&space=s1");
    const hang = lot({ actual_dryspc: "hang", planned_space_kind: "hang", planned_space_name: "Hang in Place", planned_silo_id: null });
    expect(plannedSpaceIdOf(hang)).toBeNull();
    expect(dryingLoadHref(hang, "silo", SPACES)).toBe("/station/load_silo?pick=lot1&kind=silo");
    const html = pane(page("silos", { lots: [hang] }), "available");
    expect(html).toContain("no planned space");
    const nopkg = pane(page("silos", { lots: [lot({ item_id: null })] }), "available");
    expect(nopkg).toContain("data-no-package");
  });

  it("Working: an open load under its space with the clock, Start and Pause returning here, and > into Unload Dry Space", () => {
    const loads = [load()];
    const html = page("silos", { live: live(loads) });
    const working = pane(html, "working");
    expect(working).toContain('data-schedule-count="working">1<');
    expect(working).toContain('data-drying-space="s1"');
    expect(working).toContain('<h3 class="schedule-hbn-label">Silo 1 <span class="tile-count">1</span></h3>');
    expect(working).toContain('data-drying-load="L1"');
    expect(working).toContain("data-clock");
    expect(working).toContain(">0d 04:00:00</span>");
    expect(working).toContain("Running");
    expect(working).toContain('action="/station/load_silo/L1/start"');
    expect(working).toMatch(/<button type="submit" disabled[^>]*>Start<\/button>/);
    expect(working).toContain('action="/station/load_silo/L1/pause"');
    expect(working).toContain(">Pause</button>");
    expect(working).toContain('<input type="hidden" name="next" value="/production/scheduling/silos">');
    expect(working).toContain('href="/station/unload_dry_space?pick=lotA"');
    expect(working).toContain("Wet 1,000 g");
    expect(working).not.toContain("data-unload-together-link");
    // The same load is not on another kind's surface.
    expect(pane(page("dry_rooms", { live: live(loads) }), "working")).not.toContain('data-drying-load="L1"');
    // A paused clock reads Resume; a truck lot reads its truck.
    const paused = pane(page("silos", { live: live([load({ paused_at: "2026-09-25T14:00:00.000Z", truck_number: "2" })]) }), "working");
    expect(paused).toContain(">Resume</button>");
    expect(paused).toContain("Paused");
    expect(paused).toContain("Truck 2 - 26251-PNN-GH-001-0-NA-26021");
  });

  it("Unload together: a room with two loads carries it; one load or a freezer does not; ?together opens the form", () => {
    const loads = [
      load({ id: "L3", dry_space_id: "arl", wet_weight_entry_id: "lotC", weight_grams: 500, loaded_at: "2026-09-25T13:00:00.000Z" }),
      load({ id: "L2", dry_space_id: "arl", wet_weight_entry_id: "lotB", weight_grams: 1500, loaded_at: "2026-09-25T11:00:00.000Z" }),
      load({ id: "L1", dry_space_id: "s1" }),
      load({ id: "F1", dry_space_id: "bf", wet_weight_entry_id: "lotF1" }),
      load({ id: "F2", dry_space_id: "bf", wet_weight_entry_id: "lotF2" }),
    ];
    expect(canUnloadTogether(SPACES[2], 2)).toBe(true);
    expect(canUnloadTogether(SPACES[0], 1)).toBe(false);
    expect(canUnloadTogether(SPACES[0], 2)).toBe(true);
    expect(canUnloadTogether(SPACES[3], 2)).toBe(false);
    const rooms = pane(page("dry_rooms", { live: live(loads) }), "working");
    expect(rooms).toContain('data-unload-together-link="arl"');
    expect(rooms).toContain('href="/production/scheduling/dry_rooms?together=arl"');
    expect(rooms).not.toContain("data-unload-together=");
    // First loaded first, the order the shares take.
    expect(rooms.indexOf('data-drying-load="L2"')).toBeLessThan(rooms.indexOf('data-drying-load="L3"'));
    expect(pane(page("silos", { live: live(loads) }), "working")).not.toContain("data-unload-together-link");
    expect(pane(page("freezers", { live: live(loads) }), "working")).not.toContain("data-unload-together-link");
    const open = pane(page("dry_rooms", { live: live(loads), together: "arl" }), "working");
    expect(open).toContain('action="/production/scheduling/dry_rooms/unload_together/arl"');
    expect(open).toContain('data-unload-together="arl" data-lock-on-submit');
    expect(open).toContain('form[data-lock-on-submit]');
    expect(open).toContain('<input type="hidden" name="load_ids" value="L2,L3">');
    expect(open).toContain('name="total_dry_grams"');
    expect(open).toContain('name="operator_name"');
    expect(open).toContain('name="effective_date"');
    expect(open).toContain('name="gate_choice" value="queue_adjust"');
    expect(open).toContain('name="gate_choice" value="nothing"');
    expect(open).toContain("Material: Bucked");
    expect(open).toContain("over 2,000 g");
    expect(open.indexOf('data-share-lot="lotB"')).toBeLessThan(open.indexOf('data-share-lot="lotC"'));
    // ?together on a one-load space opens nothing.
    expect(pane(page("silos", { live: live(loads), together: "s1" }), "working")).not.toContain("data-unload-together=");
  });

  it("Complete: this kind's lots unloaded in the window with the dry grams, the yield and the unload's day", () => {
    const rows = [
      done(),
      done({ lot_id: "lotD", finished_at: "2026-09-24T14:00:00.000Z", ended_at: "2026-09-24T14:00:00.000Z" }),
      done({ lot_id: "lotR", space_id: "arl", space_name: "Arlington Dry Room", space_type: "dry_room", shape: "box" }),
      done({
        lot_id: "lotF",
        status: "frozen",
        dry_weight_grams: null,
        space_id: "bf",
        space_name: "Blast Freezer(s)",
        space_type: "freezer",
        shape: "cube",
        finished_at: null,
        effective_date: null,
        ended_at: "2026-09-25T03:00:00.000Z",
      }),
    ];
    const silos = pane(page("silos", { complete: rows }), "complete");
    expect(silos).toContain('data-schedule-count="complete">1<');
    expect(silos).toContain("Unloaded in the last seven days.");
    expect((silos.match(/data-drying-lot="lotD"/g) || []).length).toBe(1);
    expect(silos).toContain('data-dry-grams="752"');
    expect(silos).toContain("Dry 752 g");
    expect(silos).toContain("Yield 60.6%");
    expect(silos).toContain('data-unload-day="2026-09-25"');
    expect(silos).not.toContain("lotR");
    const rooms = pane(page("dry_rooms", { complete: rows }), "complete");
    expect(rooms).toContain('data-drying-lot="lotR"');
    expect(rooms).toContain("Arlington Dry Room");
    const freezers = pane(page("freezers", { complete: rows }), "complete");
    expect(freezers).toContain('data-drying-lot="lotF"');
    expect(freezers).toContain("Line removed");
    expect(freezers).not.toContain("data-dry-grams");
    // 03:00 UTC is 23:00 Eastern, before six: the farm day is the 24th.
    expect(freezers).toContain('data-unload-day="2026-09-24"');
  });

  it("the yield, the unload's day and the seven farm-day window", () => {
    expect(dryingYieldPct(1240, 752)).toBe("60.6%");
    expect(dryingYieldPct(2000, 451)).toBe("22.6%");
    expect(dryingYieldPct(0, 5)).toBeNull();
    expect(dryingYieldPct(100, null)).toBeNull();
    expect(unloadDayOf(done({ effective_date: "2026-09-20" }))).toBe("2026-09-20");
    expect(unloadDayOf(done({ finished_at: null, effective_date: null, ended_at: "2026-09-25T16:00:00.000Z" }))).toBe("2026-09-25");
    // 16:00Z is noon Eastern on the 25th: the window opens at six on the 19th (10:00Z, daylight time).
    expect(dryingCompleteSince("2026-09-25T16:00:00.000Z", 6)).toBe("2026-09-19T10:00:00.000Z");
    // 09:00Z is five in the morning Eastern: still the 24th's farm day.
    expect(dryingCompleteSince("2026-09-25T09:00:00.000Z", 6)).toBe("2026-09-18T10:00:00.000Z");
  });
});

describe("THE DRYING SCHEDULE: Load Silo's picked form from a surface (canon 0.30.226)", () => {
  it("limits the select to the kind, preselects the planned space, and returns to the surface", () => {
    const picked = lot({ actual_dryspc: "arl", planned_space_name: "Arlington Dry Room" });
    const html = loadSiloPage({ barnLots: [picked], silos: SPACES, loads: [], picked, pickedLoad: null, nowIso: NOW, kind: "dry_room", space: "arl" });
    expect(html).toContain('<select name="dry_space_id" required data-space-kind="dry_room">');
    expect(html).toContain('<option value="arl" selected>Arlington Dry Room</option>');
    expect(html).not.toContain('value="s1"');
    expect(html).not.toContain('value="bf"');
    expect(html).toContain('<input type="hidden" name="next" value="/production/scheduling/dry_rooms">');
    expect(html).toContain("Dry Room <select");
    // Without a kind the form is today's.
    const plain = loadSiloPage({ barnLots: [picked], silos: SPACES, loads: [], picked, pickedLoad: null, nowIso: NOW });
    expect(plain).toContain('<select name="dry_space_id" required>');
    expect(plain).toContain('value="s1"');
    expect(plain).not.toContain('name="next"');
    // A silo-planned lot on the Silos surface; an occupied planned silo is not preselected.
    const siloLot = lot();
    const occupied = [load({ id: "L9", dry_space_id: "s2", wet_weight_entry_id: "other" })];
    const busy = loadSiloPage({ barnLots: [siloLot], silos: SPACES, loads: occupied, picked: siloLot, pickedLoad: null, nowIso: NOW, kind: "silo", space: "s2" });
    expect(busy).toContain('<option value="s2" disabled data-occupied>');
    expect(busy).not.toMatch(/<option[^>]* selected/);
    expect(busy).not.toContain('value="arl"');
    // No space of the kind: the words stand and the button waits.
    const none = loadSiloPage({ barnLots: [siloLot], silos: SPACES.slice(0, 3), loads: [], picked: siloLot, pickedLoad: null, nowIso: NOW, kind: "freezer" });
    expect(none).toContain("data-no-space-of-kind");
    expect(none).toContain("There is no space of this kind in Dry Spaces.");
    expect(none).toMatch(/<button type="submit" disabled>Load silo<\/button>/);
  });
});

describe("THE JOINT UNLOAD: the shares (canon 0.30.226)", () => {
  it("pro rata by wet grams in whole grams, half up, the remainder on the last", () => {
    expect(jointUnloadShares(1001, [1000, 2000, 3000])).toEqual([167, 334, 500]);
    expect(jointUnloadShares(602, [1500, 500])).toEqual([452, 150]);
    expect(jointUnloadShares(602, [500, 1500])).toEqual([151, 451]);
    const shares = jointUnloadShares(1234, [333, 333, 334]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1234);
    expect(jointUnloadShares(100, [])).toEqual([]);
    expect(jointUnloadShares(100, [0, 0])).toEqual([]);
    // A total too small for the rounding: the last share goes negative and the action refuses it.
    expect(jointUnloadShares(2, [1, 1, 1, 1])).toEqual([1, 1, 1, -1]);
  });
});

const ROOM = "a1000001-0001-4000-8000-000000000006";
const SILO_1 = "a1000001-0001-4000-8000-000000000001";
const FREEZER = "a1000001-0000-4000-8000-0000000000bf";
const T0 = "2026-09-24T12:00:00.000Z";

/** A finished lot waiting for a space, its born package in the barn at its wet grams (what Finish lot leaves). */
function seedDryingLot(m: MigratedDb, id: string, batchId: string, spaceId: string, grams: number): void {
  m.run(
    `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, actual_dryspc, material_form, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'bucked', 'drying', ?, ?)`,
    id,
    batchId,
    grams,
    spaceId,
    T0,
    T0
  );
  m.run(
    `INSERT INTO local_inventory_items (id, item_kind, package_code, harvest_batch_id, wet_weight_entry_id, qty, uom, farm_code, license_value, location, created_at, updated_at)
     VALUES (?, 'WIP', ?, ?, ?, ?, 'g', 'ARL', 'AU-G-C-000832', 'BARN', ?, ?)`,
    `li-${id}`,
    `PKG-${id}`,
    batchId,
    id,
    grams,
    T0,
    T0
  );
}

/** Two lots of two HBNs loaded into the Arlington Dry Room, the 1500 g lot first. */
async function roomOfTwo(m: MigratedDb, person: string): Promise<{ first: string; second: string; loadIds: string }> {
  seedBatch(m, { id: "hb-a", hbn: "26244-ARL-GH-027-0-NA-26031", serial: 431 });
  seedBatch(m, { id: "hb-b", hbn: "26244-ARL-GH-027-0-NA-26032", serial: 432 });
  seedDryingLot(m, "lot-a", "hb-a", ROOM, 1500);
  seedDryingLot(m, "lot-b", "hb-b", ROOM, 500);
  for (const lotId of ["lot-a", "lot-b"]) {
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: lotId === "lot-a" ? "hb-a" : "hb-b" }));
    const out = await loadSilo(
      m.db,
      formOf({ person_id: person, lot_id: lotId, dry_space_id: ROOM, start_time: "", loaded_at_iso: "", next: "/production/scheduling/dry_rooms" })
    );
    expect(out.redirect).toBe("/production/scheduling/dry_rooms?ok=drying_loaded");
  }
  // The order the shares take, fixed: lot-a loaded an hour before lot-b.
  const now = Date.parse(nowIso());
  m.run(`UPDATE silo_loads SET loaded_at = ? WHERE wet_weight_entry_id = 'lot-a'`, new Date(now - 7_200_000).toISOString());
  m.run(`UPDATE silo_loads SET loaded_at = ? WHERE wet_weight_entry_id = 'lot-b'`, new Date(now - 3_600_000).toISOString());
  const ids = m.all(`SELECT id FROM silo_loads WHERE dry_space_id = ? AND ended_at IS NULL ORDER BY loaded_at`, ROOM).map((row) => String(row.id));
  expect(ids).toHaveLength(2);
  return { first: "lot-a", second: "lot-b", loadIds: ids.join(",") };
}

function statusOf(m: MigratedDb, lotId: string): unknown {
  return m.get(`SELECT status FROM wet_weight_entries WHERE id = ?`, lotId)?.status;
}

describe("THE JOINT UNLOAD on a real schema (canon 0.30.226)", () => {
  it("two lots in the Arlington Dry Room share one total, one dry row each, and both finish under the group's reason", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const room = await roomOfTwo(m, person);
    const out = await unloadTogether(
      m.db,
      "dry_rooms",
      ROOM,
      formOf({ person_id: person, load_ids: room.loadIds, total_dry_grams: "602", operator_name: "Ana", gate_choice: "nothing" })
    );
    expect(out.redirect).toBe("/production/scheduling/dry_rooms?ok=unloaded_together&n=2");
    const dry = m.all(`SELECT wet_weight_entry_id AS lot, weight_grams, session_id FROM dry_weights WHERE deleted_at IS NULL ORDER BY wet_weight_entry_id`);
    expect(dry.map((row) => [row.lot, Number(row.weight_grams)])).toEqual([
      ["lot-a", 452],
      ["lot-b", 150],
    ]);
    for (const [lotId, share] of [
      ["lot-a", 452],
      ["lot-b", 150],
    ] as const) {
      expect(m.get(`SELECT status, dry_weight_grams FROM wet_weight_entries WHERE id = ?`, lotId)).toMatchObject({ status: "unloaded", dry_weight_grams: share });
      expect(m.get(`SELECT COUNT(*) AS n FROM silo_loads WHERE wet_weight_entry_id = ? AND ended_at IS NULL`, lotId)).toEqual({ n: 0 });
      const session = m.get(`SELECT id, finished_at, operator_name, weigh_mode FROM unload_sessions WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`, lotId);
      expect(session?.finished_at).toBeTruthy();
      expect(session?.operator_name).toBe("Ana");
      expect(session?.weigh_mode).toBe("bucked");
      expect(m.get(`SELECT qty, location FROM local_inventory_items WHERE wet_weight_entry_id = ?`, lotId)).toEqual({ qty: share, location: LOC_ARL_BARN });
    }
    const reason = `${SYSTEM_REASON.joint_unload}: Arlington Dry Room (${shortLotId("26244-ARL-GH-027-0-NA-26031", null)}, ${shortLotId("26244-ARL-GH-027-0-NA-26032", null)})`;
    const status = m.all(`SELECT record_id, reason FROM record_change_log WHERE record_table = 'wet_weight_entries' AND field = 'status' ORDER BY record_id`);
    expect(status).toEqual([
      { record_id: "lot-a", reason },
      { record_id: "lot-b", reason },
    ]);
    const choices = m.all(`SELECT new_value, reason FROM record_change_log WHERE field = 'reconcile_choice'`);
    expect(choices).toEqual([
      { new_value: "nothing", reason },
      { new_value: "nothing", reason },
    ]);
    expect(m.all(`SELECT DISTINCT reason FROM record_change_log WHERE record_table = 'dry_weights'`)).toEqual([{ reason }]);
    // The package rows keep the reason the adjustment file reads.
    expect(m.all(`SELECT DISTINCT reason FROM record_change_log WHERE record_table = 'local_inventory_items' AND field = 'qty'`)).toEqual([
      { reason: SYSTEM_REASON.inv_unload_adjust },
    ]);
    // The Complete pane's reader finds both today, on the room.
    const since = dryingCompleteSince(nowIso(), 6);
    const complete = await listDryingComplete(m.db, since);
    expect(complete.map((row) => row.lot_id).sort()).toEqual(["lot-a", "lot-b"]);
    expect(complete.every((row) => row.space_id === ROOM && row.space_type === "dry_room")).toBe(true);
    // The same post again (Back and resubmit) says what happened and writes nothing.
    await expect(
      unloadTogether(m.db, "dry_rooms", ROOM, formOf({ person_id: person, load_ids: room.loadIds, total_dry_grams: "602", gate_choice: "nothing" }))
    ).rejects.toThrow("Arlington Dry Room was already unloaded together; nothing was unloaded twice.");
    expect(m.all(`SELECT id FROM dry_weights`)).toHaveLength(2);
    // An empty room with no posted group: two or more loaded lots are needed.
    await expect(
      unloadTogether(m.db, "dry_rooms", ROOM, formOf({ person_id: person, load_ids: "", total_dry_grams: "602", gate_choice: "nothing" }))
    ).rejects.toThrow("Unload together needs two or more loaded lots; Arlington Dry Room holds 0. Unload the lot on Unload Dry Space.");
  });

  it("queue_adjust carries the choice and lands at the export home, as finishUnload's does (canon 0.30.1 fork 8)", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const room = await roomOfTwo(m, person);
    const out = await unloadTogether(
      m.db,
      "dry_rooms",
      ROOM,
      formOf({ person_id: person, load_ids: room.loadIds, total_dry_grams: "400", gate_choice: "queue_adjust" })
    );
    expect(out.redirect).toBe("/admin/uploads?ok=adjust_queued");
    expect(m.all(`SELECT DISTINCT new_value FROM record_change_log WHERE field = 'reconcile_choice'`)).toEqual([{ new_value: "queue_adjust" }]);
  });

  it("refuses in words and writes nothing: one load, a freezer, a changed group, a lot mid-unload, no choice, the wrong surface", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const room = await roomOfTwo(m, person);
    const before = m.get(`SELECT COUNT(*) AS n FROM record_change_log`);
    const attempt = (stage: "silos" | "dry_rooms" | "freezers", space: string, fields: Record<string, string>) =>
      unloadTogether(m.db, stage, space, formOf({ person_id: person, total_dry_grams: "602", gate_choice: "nothing", ...fields }));
    await expect(attempt("dry_rooms", ROOM, { load_ids: room.loadIds, gate_choice: "" })).rejects.toThrow(
      "Pick what to do about the difference: Queue an adjustment CSV, or Nothing, just finish."
    );
    await expect(attempt("dry_rooms", ROOM, { load_ids: room.loadIds.split(",")[0] })).rejects.toMatchObject({ status: 409 });
    await expect(attempt("dry_rooms", ROOM, { load_ids: room.loadIds, total_dry_grams: "0" })).rejects.toThrow("Total dry grams must be more than zero.");
    await expect(attempt("dry_rooms", ROOM, { load_ids: room.loadIds, gate_choice: "back" })).rejects.toThrow(
      "Pick Queue an adjustment CSV or Nothing, just finish."
    );
    await expect(attempt("silos", ROOM, { load_ids: room.loadIds })).rejects.toThrow("Arlington Dry Room is not on this surface.");
    await expect(attempt("freezers", FREEZER, { load_ids: "" })).rejects.toThrow(/a freezer has no joint unload/);
    // A backdated day without the Admin PIN refuses before any session is touched.
    await expect(attempt("dry_rooms", ROOM, { load_ids: room.loadIds, effective_date: "2026-09-01" })).rejects.toMatchObject({ status: 403 });
    expect(m.get(`SELECT COUNT(*) AS n FROM record_change_log`)).toEqual(before);
    expect(m.get(`SELECT COUNT(*) AS n FROM dry_weights`)).toEqual({ n: 0 });
    // One lot already weighed on Unload Dry Space: finish it there.
    const unload = stationByKey("unload_dry_space");
    if (!unload) throw new Error("unload station missing");
    await addLotWeight(m.db, unload, room.second, formOf({ person_id: person, weight_grams: "90" }));
    await expect(attempt("dry_rooms", ROOM, { load_ids: room.loadIds })).rejects.toThrow(/already has dry weights on Unload Dry Space/);
    expect(statusOf(m, room.first)).toBe("drying");
    expect(statusOf(m, room.second)).toBe("drying");
    // A silo with one open load has no joint unload.
    seedBatch(m, { id: "hb-s", hbn: "26244-PNN-GH-001-0-NA-26041", serial: 441, farm: "PNN" });
    seedDryingLot(m, "lot-s", "hb-s", SILO_1, 800);
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-s" }));
    await loadSilo(m.db, formOf({ person_id: person, lot_id: "lot-s", dry_space_id: SILO_1, start_time: "", loaded_at_iso: "" }));
    const siloLoad = String(m.get(`SELECT id FROM silo_loads WHERE wet_weight_entry_id = 'lot-s'`)?.id);
    await expect(attempt("silos", SILO_1, { load_ids: siloLoad })).rejects.toThrow(
      "Unload together needs two or more loaded lots; Silo 1 holds 1. Unload the lot on Unload Dry Space."
    );
    expect(statusOf(m, "lot-s")).toBe("drying");
  });

  it("a lot moved by the pencil after loading refuses the group in words and writes nothing", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const room = await roomOfTwo(m, person);
    m.run(`UPDATE wet_weight_entries SET actual_dryspc = ? WHERE id = ?`, SILO_1, room.second);
    await expect(
      unloadTogether(m.db, "dry_rooms", ROOM, formOf({ person_id: person, load_ids: room.loadIds, total_dry_grams: "602", gate_choice: "nothing" }))
    ).rejects.toThrow(/no longer stands in Arlington Dry Room \(its space changed after loading\); unload it on Unload Dry Space\./);
    expect(m.get(`SELECT COUNT(*) AS n FROM dry_weights`)).toEqual({ n: 0 });
    expect(statusOf(m, room.first)).toBe("drying");
  });

  it("a lot holding two open loads in the room is one lot with one share, and both its loads end", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const room = await roomOfTwo(m, person);
    const again = new Date(Date.parse(nowIso()) - 1_800_000).toISOString();
    m.run(
      `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, started_at, paused_seconds, created_at, updated_at)
       VALUES ('load-twice', ?, ?, ?, ?, 0, ?, ?)`,
      ROOM,
      room.first,
      again,
      again,
      again,
      again
    );
    const loadIds = `${room.loadIds},load-twice`;
    const out = await unloadTogether(
      m.db,
      "dry_rooms",
      ROOM,
      formOf({ person_id: person, load_ids: loadIds, total_dry_grams: "602", gate_choice: "nothing" })
    );
    expect(out.redirect).toBe("/production/scheduling/dry_rooms?ok=unloaded_together&n=2");
    expect(m.all(`SELECT wet_weight_entry_id AS lot, weight_grams FROM dry_weights ORDER BY wet_weight_entry_id`).map((r) => [r.lot, Number(r.weight_grams)])).toEqual([
      ["lot-a", 452],
      ["lot-b", 150],
    ]);
    expect(m.get(`SELECT COUNT(*) AS n FROM silo_loads WHERE ended_at IS NULL`)).toEqual({ n: 0 });
    expect(m.all(`SELECT record_id FROM record_change_log WHERE record_table = 'wet_weight_entries' AND field = 'status'`)).toHaveLength(2);
  });

  it("a weigh-in on Unload Dry Space landing while the joint unload runs rolls its whole batch back", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const room = await roomOfTwo(m, person);
    const unload = stationByKey("unload_dry_space");
    if (!unload) throw new Error("unload station missing");
    let weighed = false;
    const real = m.db;
    const racing = {
      prepare: (sql: string) => real.prepare(sql),
      batch: async (stmts: D1PreparedStatement[]) => {
        if (!weighed) {
          weighed = true;
          await addLotWeight(real, unload, room.second, formOf({ person_id: person, weight_grams: "90" }));
        }
        return real.batch(stmts);
      },
    } as unknown as D1Database;
    await expect(
      unloadTogether(racing, "dry_rooms", ROOM, formOf({ person_id: person, load_ids: room.loadIds, total_dry_grams: "602", gate_choice: "nothing" }))
    ).rejects.toThrow(/changed on Unload Dry Space while the joint unload ran; no lot was unloaded/);
    expect(m.all(`SELECT wet_weight_entry_id AS lot, weight_grams FROM dry_weights`).map((r) => [r.lot, Number(r.weight_grams)])).toEqual([["lot-b", 90]]);
    expect(statusOf(m, room.first)).toBe("drying");
    expect(statusOf(m, room.second)).toBe("drying");
    expect(m.get(`SELECT COUNT(*) AS n FROM silo_loads WHERE ended_at IS NULL`)).toEqual({ n: 2 });
  });

  it("a repeated post of the same group (a double tap) writes nothing twice", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    const room = await roomOfTwo(m, person);
    const fields = { person_id: person, load_ids: room.loadIds, total_dry_grams: "602", gate_choice: "nothing" };
    // The second tap has read and passed every check when the first tap's
    // batch commits; its own batch then meets the first tap's rows.
    let raced = false;
    const real = m.db;
    const racing = {
      prepare: (sql: string) => real.prepare(sql),
      batch: async (stmts: D1PreparedStatement[]) => {
        if (!raced) {
          raced = true;
          const first = await unloadTogether(real, "dry_rooms", ROOM, formOf(fields));
          expect(first.redirect).toBe("/production/scheduling/dry_rooms?ok=unloaded_together&n=2");
        }
        return real.batch(stmts);
      },
    } as unknown as D1Database;
    const second = unloadTogether(racing, "dry_rooms", ROOM, formOf(fields));
    await expect(second).rejects.toThrow("Arlington Dry Room was already unloaded together; nothing was unloaded twice.");
    expect(m.all(`SELECT wet_weight_entry_id AS lot, weight_grams FROM dry_weights ORDER BY wet_weight_entry_id`).map((r) => [r.lot, Number(r.weight_grams)])).toEqual([
      ["lot-a", 452],
      ["lot-b", 150],
    ]);
    expect(m.all(`SELECT record_id FROM record_change_log WHERE record_table = 'wet_weight_entries' AND field = 'status'`)).toHaveLength(2);
    expect(m.all(`SELECT DISTINCT dry_weight_grams FROM wet_weight_entries WHERE id IN ('lot-a', 'lot-b') ORDER BY dry_weight_grams`)).toEqual([
      { dry_weight_grams: 150 },
      { dry_weight_grams: 452 },
    ]);
  });
});

describe("THE SPLIT INTO PARTS keeps the single unload's law (canon 0.30.226)", () => {
  it("finishUnload on one lot: the gate, then unloaded under finish unload, the package to the dry grams at the barn", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-s", hbn: "26244-PNN-GH-001-0-NA-26051", serial: 451, farm: "PNN" });
    seedDryingLot(m, "lot-s", "hb-s", SILO_1, 1000);
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-s" }));
    const loaded = await loadSilo(m.db, formOf({ person_id: person, lot_id: "lot-s", dry_space_id: SILO_1, start_time: "", loaded_at_iso: "" }));
    expect(loaded.redirect).toMatch(/^\/station\/load_silo\?load=.+&ok=loaded$/);
    const unload = stationByKey("unload_dry_space");
    if (!unload) throw new Error("unload station missing");
    await addLotWeight(m.db, unload, "lot-s", formOf({ person_id: person, weight_grams: "800" }));
    const gated = await finishUnload(m.db, unload, "lot-s", formOf({ person_id: person }));
    expect(gated.redirect).toBe("/station/unload_dry_space?pick=lot-s&gate=1");
    expect(statusOf(m, "lot-s")).toBe("drying");
    const back = await finishUnload(m.db, unload, "lot-s", formOf({ person_id: person, gate_choice: "back" }));
    expect(back.redirect).toBe("/station/unload_dry_space?pick=lot-s");
    const out = await finishUnload(m.db, unload, "lot-s", formOf({ person_id: person, gate_choice: "nothing" }));
    expect(out.redirect).toBe("/station/unload_dry_space?ok=unloaded");
    expect(statusOf(m, "lot-s")).toBe("unloaded");
    expect(m.get(`SELECT reason FROM record_change_log WHERE record_table = 'wet_weight_entries' AND field = 'status'`)).toEqual({
      reason: SYSTEM_REASON.finish_unload,
    });
    expect(m.get(`SELECT new_value, reason FROM record_change_log WHERE field = 'reconcile_choice'`)).toEqual({
      new_value: "nothing",
      reason: SYSTEM_REASON.finish_unload,
    });
    expect(m.get(`SELECT qty, location FROM local_inventory_items WHERE wet_weight_entry_id = 'lot-s'`)).toEqual({ qty: 800, location: LOC_BARN });
    expect(m.get(`SELECT COUNT(*) AS n FROM silo_loads WHERE ended_at IS NULL`)).toEqual({ n: 0 });
  });

  it("a freezer's unload still removes the line and weighs nothing", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-f", hbn: "26244-PNN-GH-001-0-NA-26061", serial: 461, farm: "PNN" });
    seedDryingLot(m, "lot-f", "hb-f", FREEZER, 700);
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-f" }));
    await loadSilo(m.db, formOf({ person_id: person, lot_id: "lot-f", dry_space_id: FREEZER, start_time: "", loaded_at_iso: "" }));
    const unload = stationByKey("unload_dry_space");
    if (!unload) throw new Error("unload station missing");
    const out = await finishUnload(m.db, unload, "lot-f", formOf({ person_id: person }));
    expect(out.redirect).toBe("/station/unload_dry_space?ok=frozen");
    expect(statusOf(m, "lot-f")).toBe("frozen");
    const complete = await listDryingComplete(m.db, dryingCompleteSince(nowIso(), 6));
    expect(complete.find((row) => row.lot_id === "lot-f")).toMatchObject({ space_type: "freezer", status: "frozen", finished_at: null });
  });
});

describe("THE DRYING SCHEDULE: the returns and the window on a real schema (canon 0.30.226)", () => {
  it("Start and Pause return to the surface that sent them, and to Load Silo otherwise", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    seedBatch(m, { id: "hb-s", hbn: "26244-PNN-GH-001-0-NA-26071", serial: 471, farm: "PNN" });
    seedDryingLot(m, "lot-s", "hb-s", SILO_1, 900);
    await scheduleLogisticsLot(m.db, formOf({ person_id: person, harvest_batch_id: "hb-s" }));
    await loadSilo(m.db, formOf({ person_id: person, lot_id: "lot-s", dry_space_id: SILO_1, start_time: "", loaded_at_iso: "" }));
    const loadId = String(m.get(`SELECT id FROM silo_loads WHERE wet_weight_entry_id = 'lot-s'`)?.id);
    const next = "/production/scheduling/silos";
    expect((await startSiloLoad(m.db, loadId, formOf({ person_id: person, next }))).redirect).toBe(next);
    expect((await pauseSiloLoad(m.db, loadId, formOf({ person_id: person, next }))).redirect).toBe(next);
    expect(m.get(`SELECT paused_at FROM silo_loads WHERE id = ?`, loadId)?.paused_at).toBeTruthy();
    expect((await pauseSiloLoad(m.db, loadId, formOf({ person_id: person, next: "https://elsewhere.example/" }))).redirect).toBe(
      `/station/load_silo?load=${loadId}`
    );
    expect(m.get(`SELECT paused_at FROM silo_loads WHERE id = ?`, loadId)?.paused_at).toBeNull();
  });

  it("listDryingComplete: today's unload in, one eight days back out, a demoted lot out", async () => {
    const m = await migratedDb();
    seedBatch(m, { id: "hb-a", hbn: "26244-PNN-GH-001-0-NA-26081", serial: 481, farm: "PNN" });
    const now = nowIso();
    const old = new Date(Date.parse(now) - 8 * 86_400_000).toISOString();
    const insertLot = (id: string, status: string) =>
      m.run(
        `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, dry_weight_grams, actual_dryspc, status, created_at, updated_at)
         VALUES (?, 'hb-a', 1000, 250, ?, ?, ?, ?)`,
        id,
        SILO_1,
        status,
        T0,
        T0
      );
    const insertSession = (id: string, lotId: string, finished: string) =>
      m.run(
        `INSERT INTO unload_sessions (id, wet_weight_entry_id, weigh_mode, finished_at, effective_date, created_at, updated_at)
         VALUES (?, ?, 'bucked', ?, ?, ?, ?)`,
        id,
        lotId,
        finished,
        finished.slice(0, 10),
        finished,
        finished
      );
    insertLot("lot-today", "trimmed");
    insertSession("us-today", "lot-today", now);
    insertLot("lot-old", "unloaded");
    insertSession("us-old", "lot-old", old);
    insertLot("lot-demoted", "drying");
    insertSession("us-demoted", "lot-demoted", now);
    const rows = await listDryingComplete(m.db, dryingCompleteSince(now, 6));
    expect(rows.map((row) => row.lot_id)).toEqual(["lot-today"]);
    expect(rows[0]).toMatchObject({ space_name: "Silo 1", space_type: "silo", dry_weight_grams: 250, weight_grams: 1000 });
  });
});

describe("THE DRYING SCHEDULE: the routes (canon 0.30.226)", () => {
  function env(db: D1Database): Env {
    return {
      DB: db,
      THEME: "grip",
      ASSETS: { fetch: () => Promise.resolve(new Response("no", { status: 404 })) } as unknown as Env["ASSETS"],
    } as unknown as Env;
  }

  it("each surface answers with its panes under the silo strip; a drying stage is not a line", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    await roomOfTwo(m, person);
    for (const [path, title] of [
      ["/production/scheduling/silos", "Silos"],
      ["/production/scheduling/dry_rooms", "Dry Rooms"],
      ["/production/scheduling/freezers", "Freezers"],
    ] as const) {
      const res = await app.request(path, {}, env(m.db));
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain(`<h1>${title}</h1>`);
      expect(body).toContain("data-silo-strip");
      expect(body).toContain('data-schedule-pane="working"');
    }
    const rooms = await (await app.request("/production/scheduling/dry_rooms?together=" + ROOM, {}, env(m.db))).text();
    expect(rooms).toContain(`data-unload-together="${ROOM}"`);
    expect(rooms).toContain('data-back-link');
    expect(rooms).toContain("Drying Operations");
    expect((await app.request("/production/scheduling/nope", {}, env(m.db))).status).toBe(404);
    const line = await app.request("/production/scheduling/silos/schedule", { method: "POST", body: new URLSearchParams({ hbn_id: "hb-a" }) }, env(m.db));
    expect(line.status).toBe(404);
    const unknown = await app.request(`/production/scheduling/trim/unload_together/${ROOM}`, { method: "POST", body: new URLSearchParams({}) }, env(m.db));
    expect(unknown.status).toBe(404);
  });
});
