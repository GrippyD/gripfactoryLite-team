import { describe, expect, it } from "vitest";
import { cureFullnessPct, latestReading, listCurePanes } from "../src/cure";
import { directorWallPage, loadDirectorWall } from "../src/director";
import { LB_GRAMS, assembleSiloVisuals, loadSiloVisuals, type SiloVisual } from "../src/silo";
import type { SiloLoadRow, SiloLotGramsRow } from "../src/db";
import {
  buildStorageModel,
  farmClockLabel,
  isStorageSpace,
  readAgeLabel,
  siloTilePct,
  storageBody,
  storageDetail,
  type StorageBuildInput,
  type StorageRoom,
} from "../src/storagecapacity";
import { migratedDb, seedBatch } from "./migrated";

const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const NOW = "2026-10-15T12:00:00.000Z";
const CAP = 15000 * LB_GRAMS;
const TS = "2026-10-15T00:00:00.000Z";

function space(over: Partial<StorageBuildInput["spaces"][number]> & { id: string; name: string }): StorageBuildInput["spaces"][number] {
  return {
    shape: "cylinder",
    farm_code: "PNN",
    space_type: "silo",
    capacity: 15000,
    capacity_uom: "lb",
    location_name: null,
    kind: "silo",
    door_read_at: null,
    ...over,
  };
}

function load(over: Partial<SiloLoadRow> = {}): SiloLoadRow {
  return {
    id: "L1",
    dry_space_id: "s2",
    silo_name: "Silo 2",
    wet_weight_entry_id: "lot1",
    hbn: "26257-PNN-GH-027-0-NA-26010",
    metrc_harvest_tag: null,
    strain_label: "Gelato",
    farm_code: "PNN",
    weight_grams: CAP / 2,
    loaded_at: "2026-10-15T10:00:00.000Z",
    started_at: null,
    paused_at: null,
    paused_seconds: 0,
    ended_at: null,
    notes: null,
    ...over,
  };
}

function baseInput(over: Partial<StorageBuildInput> = {}): StorageBuildInput {
  return {
    spaces: [],
    loads: [],
    grams: [],
    departures: [],
    capacityRaw: "15000",
    yieldRaw: "22",
    cureRows: [],
    ranges: [],
    averages: new Map(),
    staleMinutes: 60,
    nowIso: NOW,
    ...over,
  };
}

function roomPct(model: { rooms: StorageRoom[] }, name: string): number {
  const room = model.rooms.find((row) => row.name === name);
  if (!room) throw new Error(`missing ${name}`);
  return room.pct;
}

describe("storage capacity bars", () => {
  it("a silo's percent equals the silo tile's level for loading, drying, unloading, and empty", () => {
    const spaces = [space({ id: "s1", name: "Silo 1" }), space({ id: "s2", name: "Silo 2" }), space({ id: "s4", name: "Silo 4" }), space({ id: "s3", name: "Silo 3" })];
    const grams: SiloLotGramsRow[] = [{ dry_space_id: "s1", status: "weighing", weight_grams: CAP * 0.72, lots: 1, lot_id: "f1", hbn: "26111-PNN-OD-001-0-NA-26111", metrc_harvest_tag: null }];
    const loads = [
      load({ dry_space_id: "s2", weight_grams: CAP / 2, dry_weight_grams: null }),
      load({ id: "L4", dry_space_id: "s4", weight_grams: 1132, dry_weight_grams: 50, hbn: "26112-PNN-OD-001-0-NA-26112" }),
    ];
    const input = baseInput({ spaces, loads, grams });
    const model = buildStorageModel(input);
    const live = assembleSiloVisuals(spaces, loads, grams, CAP, 22);
    for (const row of live) {
      expect(roomPct(model, row.silo.name), row.silo.name).toBe(siloTilePct(row.visual.level));
      expect(roomPct(model, row.silo.name)).toBe(Math.round(row.visual.level * 100));
    }
    const byName = new Map(model.rooms.map((row) => [row.name, row]));
    expect(byName.get("Silo 1")?.stateKey).toBe("filling");
    expect(byName.get("Silo 2")?.stateKey).toBe("drying");
    expect(byName.get("Silo 4")?.stateKey).toBe("unloading");
    expect(byName.get("Silo 3")?.stateKey).toBe("empty");
    expect(byName.get("Silo 3")?.pct).toBe(0);
    expect(storageDetail(byName.get("Silo 1") as StorageRoom, "en")).toContain("Filling");
    expect(storageDetail(byName.get("Silo 2") as StorageRoom, "en")).toContain("Drying");
    expect(storageDetail(byName.get("Silo 4") as StorageRoom, "en")).toContain("Unloading");
    expect(storageDetail(byName.get("Silo 3") as StorageRoom, "en")).toContain("Empty");
    expect(storageDetail(byName.get("Silo 1") as StorageRoom, "en")).toContain("of 15,000 wet lb");
    expect(storageDetail(byName.get("Silo 1") as StorageRoom, "en")).toContain("Lots 26111");
  });

  it("the Arlington Dry Room reads by the same law", () => {
    const arlington = space({ id: "arl", name: "Arlington Dry Room", space_type: "dry_room", shape: "box", kind: "silo", farm_code: "ARL" });
    const loads = [load({ dry_space_id: "arl", silo_name: "Arlington Dry Room", weight_grams: 1000 * LB_GRAMS })];
    const input = baseInput({ spaces: [arlington], loads });
    const model = buildStorageModel(input);
    const [live] = assembleSiloVisuals([arlington], loads, [], CAP, 22);
    expect(roomPct(model, "Arlington Dry Room")).toBe(siloTilePct((live as { visual: SiloVisual }).visual.level));
    expect(model.rooms[0]?.shortName).toBe("ARL");
  });

  it("a silo kind room over its capacity prints its true percent, not the tile's clamped 100 (Scribe gate fix)", () => {
    const arlington = space({ id: "arl", name: "Arlington Dry Room", space_type: "dry_room", shape: "box", kind: "silo", farm_code: "ARL" });
    const loads = [load({ dry_space_id: "arl", silo_name: "Arlington Dry Room", weight_grams: 30000 * LB_GRAMS })];
    const model = buildStorageModel(baseInput({ spaces: [arlington], loads }));
    const [live] = assembleSiloVisuals([arlington], loads, [], CAP, 22);
    expect(siloTilePct((live as { visual: SiloVisual }).visual.level)).toBe(100);
    expect(roomPct(model, "Arlington Dry Room")).toBe(200);
    expect(storageDetail(model.rooms[0] as StorageRoom, "en")).toContain("30,000 of 15,000 wet lb");
  });

  it("CSA and CSB read lots over capacity, and a room over 100 draws to the top", () => {
    const spaces = [
      space({ id: "csa", name: "CSA", kind: "cure", space_type: "cure", capacity: 36, capacity_uom: "ea", shape: "bar" }),
      space({ id: "csb", name: "CSB", kind: "cure", space_type: "cure", capacity: 8, capacity_uom: "ea", shape: "bar" }),
    ];
    const cureRows = [
      { status: "unloaded", trim_status: null, hbn: "26120-PNN-GH-001-0-NA-26120" },
      { status: "unloaded", trim_status: "scheduled", hbn: "26121-PNN-GH-001-0-NA-26121" },
      { status: "trimmed", trim_status: null, hbn: "26122-PNN-GH-001-0-NA-26122" },
    ];
    const model = buildStorageModel(baseInput({ spaces, cureRows }));
    expect(roomPct(model, "CSA")).toBe(cureFullnessPct(1, 36));
    expect(roomPct(model, "CSB")).toBe(cureFullnessPct(1, 8));
    expect(model.rooms.find((row) => row.name === "CSA")?.lots).toEqual(["26120"]);
    expect(storageDetail(model.rooms.find((row) => row.name === "CSA") as StorageRoom, "en")).toContain("1 of 36 lots");
    const over = storageBody(
      {
        nowIso: "2026-10-15T16:14:00.000Z",
        rooms: [{ id: "csa", name: "CSA", shortName: "CSA", pct: 140, stateKey: "", kind: "lots", amount: 50, cap: 36, lots: ["26001"], env: null }],
      },
      "en"
    );
    expect(over).toContain(">140%<");
    expect(over).toContain('data-dd-cap-marker="1"');
    expect(over).toContain('y="22"');
    expect(over).toContain("50 of 36 lots");
    expect(over).toContain(`Live as of ${farmClockLabel("2026-10-15T16:14:00.000Z")}`);
    expect(over).toContain("Live as of 12:14 PM");
    const empty = storageBody(
      {
        nowIso: NOW,
        rooms: [{ id: "s3", name: "Silo 3", shortName: "S3", pct: 0, stateKey: "empty", kind: "wet", amount: 0, cap: 15000, lots: [], env: null }],
      },
      "en"
    );
    expect(empty).toContain(">0%<");
    expect(empty).toContain('data-dd-cap-fill="stub"');
    expect(DASH.test(over + empty)).toBe(false);
  });

  it("drops the freezer, Hang in Place, and the Truck, and keeps a new space with a capacity", () => {
    expect(isStorageSpace({ kind: "silo", space_type: "freezer", capacity: 800, name: "Cold Box" } as never)).toBe(false);
    expect(isStorageSpace({ kind: "hang", space_type: "dry_room", capacity: 15000 })).toBe(false);
    expect(isStorageSpace({ kind: "truck", space_type: "silo", capacity: 100 })).toBe(false);
    expect(isStorageSpace({ kind: "silo", space_type: "silo", capacity: null })).toBe(false);
    expect(isStorageSpace({ kind: "silo", space_type: "silo", capacity: 1000 })).toBe(true);
    const spaces = [
      space({ id: "bf", name: "Blast Freezer(s)", kind: "silo", space_type: "freezer", capacity: 800 }),
      space({ id: "hang", name: "Hang in Place", kind: "hang", space_type: "dry_room", capacity: 15000 }),
      space({ id: "truck", name: "Truck", kind: "truck", space_type: "silo", capacity: 500 }),
      space({ id: "s1", name: "Silo 1" }),
      space({ id: "west", name: "West Loft", capacity: 1000 }),
      space({ id: "csa", name: "CSA", kind: "cure", space_type: "cure", capacity: 36, capacity_uom: "ea" }),
    ];
    const names = buildStorageModel(baseInput({ spaces })).rooms.map((row) => row.name);
    expect(names).toEqual(["Silo 1", "West Loft", "CSA"]);
  });

  it("flags a warm cure room, prints a stale age, and leaves a sensorless silo blank", () => {
    expect(readAgeLabel(2 * 60 * 60 * 1000)).toBe("2 h");
    const fresh = {
      room: "CSA",
      temperatureF: 63,
      humidityPct: 47,
      readAt: "2026-10-15T11:50:00.000Z",
      source: "silo-ops",
      units: 2,
      sensorIds: ["csa-a", "csa-b"],
    };
    const stale = {
      room: "CSB",
      temperatureF: 64,
      humidityPct: 45,
      readAt: "2026-10-15T10:00:00.000Z",
      source: "silo-ops",
      units: 1,
      sensorIds: ["csb-a"],
    };
    const spaces = [
      space({ id: "s1", name: "Silo 1" }),
      space({ id: "csa", name: "CSA", kind: "cure", space_type: "cure", capacity: 36, capacity_uom: "ea" }),
      space({ id: "csb", name: "CSB", kind: "cure", space_type: "cure", capacity: 8, capacity_uom: "ea" }),
    ];
    const model = buildStorageModel(
      baseInput({
        spaces,
        averages: new Map([
          ["CSA", fresh],
          ["CSB", stale],
        ]),
        ranges: [{ space_name: "CSA", temp_low: 55, temp_high: 60, humidity_low: null, humidity_high: null }],
      })
    );
    const html = storageBody(model, "en");
    const csa = model.rooms.find((row) => row.name === "CSA") as StorageRoom;
    const csb = model.rooms.find((row) => row.name === "CSB") as StorageRoom;
    const silo = model.rooms.find((row) => row.name === "Silo 1") as StorageRoom;
    expect(csa.env?.warn).toBe(true);
    expect(csb.env?.stale).toBe(true);
    expect(silo.env).toBeNull();
    expect(html).toContain("63.0 F, 47% RH");
    expect(html).toContain("dd-cap-env-warn");
    expect(html).toContain("no read for 2 h");
    const siloAt = html.indexOf('data-dd-cap-room="Silo 1"');
    expect(html.slice(siloAt, html.indexOf("</g>", siloAt))).not.toContain("data-dd-cap-env");
    expect(storageDetail(csa, "en")).toContain("Sensors csa-a, csa-b");
    expect(storageDetail(csa, "en")).toContain("Range 55.0 to 60.0 F");
    expect(DASH.test(html)).toBe(false);
  });

  it("the wall's bars match the silo tiles and the cure panes for the same rows", async () => {
    const m = await migratedDb();
    const silos = m.all(`SELECT id, name FROM dry_spaces WHERE deleted_at IS NULL AND name IN ('Silo 1', 'Silo 2', 'Silo 3', 'Silo 4', 'Arlington Dry Room')`);
    const idOf = (name: string) => String(silos.find((row) => row.name === name)?.id);
    m.run(`INSERT INTO strains (id, name, hbn_code, created_at, updated_at) VALUES ('st-cap', 'Cap Strain', '111', ?, ?)`, TS, TS);
    const batch = seedBatch(m, { id: "b-cap", hbn: "26130-PNN-GH-111-0-NA-26130", serial: 830, farm: "PNN", strainId: "st-cap" });
    const batchB = seedBatch(m, { id: "b-cap-b", hbn: "26131-PNN-GH-111-0-NA-26131", serial: 831, farm: "PNN", strainId: "st-cap" });
    const fill = "e-fill";
    const dry = "e-dry";
    const unload = "e-unload";
    const room = "e-room";
    const csa = "e-csa";
    const csb = "e-csb";
    const insertLot = (id: string, batchId: string, spaceId: string, grams: number, status: string, dryGrams: number | null) => {
      m.run(
        `INSERT INTO wet_weight_entries (id, harvest_batch_id, weight_grams, dry_weight_grams, actual_dryspc, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        batchId,
        grams,
        dryGrams,
        spaceId,
        status,
        TS,
        TS
      );
    };
    insertLot(fill, batch, idOf("Silo 1"), Math.round(CAP * 0.72), "weighing", null);
    insertLot(dry, batch, idOf("Silo 2"), CAP / 2, "drying", null);
    insertLot(unload, batch, idOf("Silo 4"), 1132, "drying", 50);
    insertLot(room, batch, idOf("Arlington Dry Room"), 1000 * LB_GRAMS, "drying", null);
    insertLot(csa, batch, idOf("Silo 3"), 1000, "unloaded", 800);
    insertLot(csb, batchB, idOf("Silo 3"), 1000, "unloaded", 800);
    const open = (id: string, spaceId: string, lotId: string) => {
      m.run(
        `INSERT INTO silo_loads (id, dry_space_id, wet_weight_entry_id, loaded_at, paused_seconds, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        id,
        spaceId,
        lotId,
        "2026-10-15T10:00:00.000Z",
        TS,
        TS
      );
    };
    open("ld-dry", idOf("Silo 2"), dry);
    open("ld-unload", idOf("Silo 4"), unload);
    open("ld-room", idOf("Arlington Dry Room"), room);
    m.run(
      `INSERT INTO production_schedules (id, stage, wet_weight_entry_id, harvest_batch_id, status, scheduled_at, created_at, updated_at)
       VALUES ('ps-csb', 'trim', ?, ?, 'scheduled', ?, ?, ?)`,
      csb,
      batchB,
      TS,
      TS,
      TS
    );
    m.run(`UPDATE dry_spaces SET capacity = 15000, capacity_uom = 'lb' WHERE name = 'Hang in Place'`);
    m.run(`UPDATE dry_spaces SET capacity = 500, capacity_uom = 'lb' WHERE name = 'Truck'`);
    m.run(
      `INSERT INTO dry_spaces (id, name, kind, farm_code, shape, space_type, capacity, capacity_uom, created_at, updated_at)
       VALUES ('west-loft', 'West Loft', 'silo', 'PNN', 'cylinder', 'silo', 1000, 'lb', ?, ?)`,
      TS,
      TS
    );
    const read = (id: string, roomName: string, temp: number, rh: number, at: string, sensor: string) => {
      m.run(
        `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, sensor_id, role)
         VALUES (?, ?, ?, ?, 'silo-ops', ?, ?, ?, NULL)`,
        id,
        roomName,
        temp,
        rh,
        at,
        at,
        sensor
      );
    };
    read("r-csa-a", "CSA", 62, 46, "2026-10-15T11:50:00.000Z", "csa-a");
    read("r-csa-b", "CSA", 64, 48, "2026-10-15T11:50:00.000Z", "csa-b");
    read("r-csb", "CSB", 64, 45, "2026-10-15T10:00:00.000Z", "csb-a");
    m.run(
      `INSERT INTO environment_ranges (id, space_name, role, temp_low, temp_high, humidity_low, humidity_high, created_at, updated_at)
       VALUES ('rng-csa', 'CSA', 'room', 55, 60, NULL, NULL, ?, ?)`,
      TS,
      TS
    );
    const wall = await loadDirectorWall(m.db, "bizops", "2026-10-15", null, null, NOW);
    const html = directorWallPage(wall, "en");
    const tile = wall.groups.flatMap((group) => group.tiles).find((row) => row.kpi.kpi_key === "bizops.storage_capacity");
    expect(tile?.storage).toBeTruthy();
    const visuals = await loadSiloVisuals(m.db);
    for (const row of visuals.live) {
      const name = row.silo.name;
      const marker = `data-dd-cap-room="${name}"`;
      if (String(row.silo.space_type) === "freezer") {
        expect(html).not.toContain(marker);
        continue;
      }
      expect(html).toContain(`${marker} data-dd-cap-pct="${siloTilePct(row.visual.level)}"`);
    }
    const cure = await listCurePanes(m.db, NOW, "en");
    expect(html).toContain(`data-dd-cap-room="CSA" data-dd-cap-pct="${cureFullnessPct(cure.csa.length, cure.caps.CSA)}"`);
    expect(html).toContain(`data-dd-cap-room="CSB" data-dd-cap-pct="${cureFullnessPct(cure.csb.length, cure.caps.CSB)}"`);
    const csaRead = await latestReading(m.db, "CSA");
    expect(csaRead).toBeTruthy();
    expect(html).toContain(`${csaRead?.temperatureF.toFixed(1)} F, ${Math.round(Number(csaRead?.humidityPct))}% RH`);
    expect(html).toContain("dd-cap-env-warn");
    expect(html).toContain("no read for 2 h");
    expect(html).not.toContain('data-dd-cap-room="Hang in Place"');
    expect(html).not.toContain('data-dd-cap-room="Truck"');
    expect(html).not.toContain('data-dd-cap-room="Blast Freezer(s)"');
    expect(html).toContain('data-dd-cap-room="West Loft"');
    expect(html).toContain("Storage Capacity Utilization");
    expect(html).toContain('data-dd-version="1"');
    expect(html).toContain("Live as of 8:00 AM");
    expect(html).not.toContain('data-dd-kpi="harvest.wet_weight_lb"');
    const names = [...html.matchAll(/data-dd-cap-room="([^"]+)"/g)].map((hit) => hit[1]);
    expect(names.slice(0, 6)).toEqual(["Silo 1", "Silo 2", "Silo 3", "Silo 4", "Silo 5", "West Loft"]);
    expect(names).toContain("Arlington Dry Room");
    expect(names).toContain("CSA");
    expect(names).toContain("CSB");
    expect(names.indexOf("Arlington Dry Room")).toBeLessThan(names.indexOf("CSA"));
    expect(names.indexOf("CSA")).toBeLessThan(names.indexOf("CSB"));
    expect(DASH.test(html.slice(html.indexOf("data-dd-cap"), html.indexOf("</article>", html.indexOf("data-dd-cap"))))).toBe(false);
  });
});
