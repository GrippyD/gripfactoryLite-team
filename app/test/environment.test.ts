import { describe, expect, it } from "vitest";
import { doorRoomNames, environmentFlagLines, environmentPage, listDoorAverages, loadEnvironmentPage, newestReadings, saveEnvironmentRange, saveSensorBinding } from "../src/environment";
import { curePanes, listCurePanes, storeSensorReadings } from "../src/cure";
import { pullSensorPush, refreshSensorCatalog } from "../src/sensorpush";
import { siloLiveEntry, type SiloVisual } from "../src/silo";
import { formOf, migratedDb, seedPerson } from "./migrated";

const NOW = "2026-09-27T16:00:00.000Z";

describe("THE ENVIRONMENT FLAGS (canon 0.30.246)", () => {
  const range = { tempLow: 55, tempHigh: 100, humidityLow: 40, humidityHigh: 62 };

  it("names an out reading, a humidity break, a stale reading, and stays quiet when in", () => {
    const fresh = { temperatureF: 104.2, humidityPct: 50, readAt: "2026-09-27T15:50:00.000Z" };
    expect(environmentFlagLines("plenum", fresh, range, NOW, 60, "2026-09-27T15:00:00.000Z")).toEqual(["Plenum 104.2 F, above 100 F"]);
    const humid = { temperatureF: 70, humidityPct: 71, readAt: "2026-09-27T15:50:00.000Z" };
    expect(environmentFlagLines("room", humid, range, NOW, 60, null)).toEqual(["Room humidity 71 %, above 62 %"]);
    const low = { temperatureF: 50, humidityPct: 50, readAt: "2026-09-27T15:50:00.000Z" };
    expect(environmentFlagLines("bed", low, range, NOW, 60, null)[0]).toBe("Bed 50 F, below 55 F");
    const old = { temperatureF: 104.2, humidityPct: 50, readAt: "2026-09-27T14:00:00.000Z" };
    expect(environmentFlagLines("bed", old, range, NOW, 60, "2026-09-27T12:00:00.000Z")).toEqual(["Bed no reading for 2 h 0 m"]);
    expect(environmentFlagLines("exhaust", null, range, NOW, 60, "2026-09-27T14:20:00.000Z")).toEqual(["Exhaust no reading for 1 h 40 m"]);
    const fine = { temperatureF: 70, humidityPct: 50, readAt: "2026-09-27T15:50:00.000Z" };
    expect(environmentFlagLines("room", fine, range, NOW, 60, null)).toEqual([]);
    const freezer = { temperatureF: 20, humidityPct: null, readAt: "2026-09-27T15:55:00.000Z" };
    expect(environmentFlagLines("room", freezer, { tempLow: null, tempHigh: 10, humidityLow: null, humidityHigh: null }, NOW, 60, null)).toEqual([
      "Room 20 F, above 10 F",
    ]);
  });

  it("pulls the newest sample once, keeps the token, skips a 429, and does not call without secrets", async () => {
    const m = await migratedDb();
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (url.endsWith("/oauth/authorize")) return new Response(JSON.stringify({ authorization: "auth-1" }));
      if (url.endsWith("/oauth/accesstoken")) return new Response(JSON.stringify({ accesstoken: "token-1" }));
      if (url.endsWith("/samples")) {
        if (body.fail) return new Response("no", { status: 429 });
        return new Response(
          JSON.stringify({
            sensors: {
              "sp-1": [
                { observed: "2026-09-27T15:00:00.000Z", temperature: 60, humidity: 40 },
                { observed: "2026-09-27T15:40:00.000Z", temperature: 104.2, humidity: 71 },
              ],
            },
          })
        );
      }
      return new Response("no", { status: 500 });
    };
    const env = { DB: m.db, SENSORPUSH_EMAIL: "a@b.c", SENSORPUSH_PASSWORD: "secret", SENSORPUSH_API_BASE: "https://fixture.test/api/v1" };
    const skipped = await pullSensorPush({ DB: m.db }, fetchImpl);
    expect(skipped.skipped).toBe(true);
    expect(calls).toEqual([]);
    m.run(
      `INSERT INTO sensor_bindings (id, sensor_id, space_name, role, bound_at, created_at, updated_at)
       VALUES ('b1', 'sp-1', 'Silo 3', 'plenum', '2026-09-27T15:00:00.000Z', '2026-09-27T15:00:00.000Z', '2026-09-27T15:00:00.000Z')`
    );
    const first = await pullSensorPush(env, fetchImpl);
    expect(first).toMatchObject({ skipped: false, count: 1, error: null });
    expect(calls.map((url) => url.slice(url.lastIndexOf("/") + 1))).toEqual(["authorize", "accesstoken", "samples"]);
    const stored = m.get(`SELECT room, temperature_f, humidity_pct, role, source FROM sensor_readings WHERE sensor_id = 'sp-1'`);
    expect(stored).toMatchObject({ room: "Silo 3", temperature_f: 104.2, humidity_pct: 71, role: "plenum", source: "sensorpush" });
    expect(m.get(`SELECT access_token FROM sensorpush_auth WHERE id = 'current'`)?.access_token).toBe("token-1");
    calls.length = 0;
    const again = await pullSensorPush(env, fetchImpl);
    expect(again.count).toBe(0);
    expect(calls.map((url) => url.split("/").pop())).toEqual(["samples"]);
    const blocked: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response("no", { status: 429 });
    };
    calls.length = 0;
    const refused = await pullSensorPush(env, blocked);
    expect(refused.error).toBe("HTTP 429");
    expect(m.get(`SELECT error FROM environment_pulls WHERE error IS NOT NULL`)?.error).toBe("HTTP 429");
    expect(m.all(`SELECT id FROM sensor_readings WHERE sensor_id = 'sp-1'`)).toHaveLength(1);
  });

  it("saves a binding and a range and renders them", async () => {
    const m = await migratedDb();
    const person = seedPerson(m);
    m.run(`INSERT INTO sensor_catalog (sensor_id, name, battery_voltage, seen_at) VALUES ('sp-1', 'Silo 3 sensor', 3.1, '2026-09-27T15:00:00.000Z')`);
    await saveSensorBinding(m.db, formOf({ person_id: person, sensor_id: "sp-1", space_name: "Silo 3", role: "plenum", reason: "bind the plenum" }));
    await saveEnvironmentRange(m.db, formOf({ person_id: person, space_name: "Silo 3", role: "plenum", temp_high: "100", reason: "the high" }));
    const firstLog = m.all(
      `SELECT field, old_value, new_value, reason FROM record_change_log WHERE record_table = 'environment_ranges' ORDER BY field`
    );
    expect(firstLog).toEqual([
      { field: "humidity_high", old_value: null, new_value: null, reason: "the high" },
      { field: "humidity_low", old_value: null, new_value: null, reason: "the high" },
      { field: "temp_high", old_value: null, new_value: "100", reason: "the high" },
      { field: "temp_low", old_value: null, new_value: null, reason: "the high" },
    ]);
    await saveEnvironmentRange(
      m.db,
      formOf({ person_id: person, space_name: "Silo 3", role: "plenum", temp_low: "55", temp_high: "110", humidity_low: "40", humidity_high: "62", reason: "the bounds" })
    );
    const secondLog = m.all(
      `SELECT field, old_value, new_value, reason FROM record_change_log WHERE record_table = 'environment_ranges' AND reason = 'the bounds' ORDER BY field`
    );
    expect(secondLog).toEqual([
      { field: "humidity_high", old_value: null, new_value: "62", reason: "the bounds" },
      { field: "humidity_low", old_value: null, new_value: "40", reason: "the bounds" },
      { field: "temp_high", old_value: "100", new_value: "110", reason: "the bounds" },
      { field: "temp_low", old_value: null, new_value: "55", reason: "the bounds" },
    ]);
    const page = await loadEnvironmentPage(m.db);
    expect(page.sensors[0]).toMatchObject({ sensor_id: "sp-1", space_name: "Silo 3", role: "plenum" });
    expect(page.ranges[0]).toMatchObject({ space_name: "Silo 3", role: "plenum", temp_low: 55, temp_high: 110, humidity_low: 40, humidity_high: 62 });
    const html = environmentPage(page, "en");
    expect(html).toContain('data-env-sensor="sp-1"');
    expect(html).toContain("Silo 3");
    expect(html).toContain('data-env-silo-ops');
    expect(html).toContain("Silo Ops posts its Storage readings for CSA and CSB here with source &quot;silo-ops&quot;, at most once a minute per room, read_at the unit's own sample time in UTC.");
    expect(environmentPage(page, "es")).toContain("Releer sensores");
    expect(environmentPage(page, "es")).toContain("Silo Ops publica aqui sus lecturas de Storage para CSA y CSB con source &quot;silo-ops&quot;, a lo sumo una vez por minuto por sala, read_at la hora de muestra de la unidad en UTC.");
    const visual = { state: "drying", label: "drying", wetGrams: 0, level: 0, fill: null, throb: null, unloadedDryGrams: 0, unloadedShare: 0, freezer: false } as SiloVisual;
    const live = siloLiveEntry("s3", "Silo 3", visual, "en", "cylinder", ["Plenum 104.2 F, above 100 F"]);
    expect(live.state).toBe("drying");
    expect(live.wetGrams).toBe(0);
    expect(live.flags).toEqual(["Plenum 104.2 F, above 100 F"]);
  });

  it("refreshes the catalog from the sensor list", async () => {
    const m = await migratedDb();
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/oauth/authorize")) return new Response(JSON.stringify({ authorization: "auth-1" }));
      if (url.endsWith("/oauth/accesstoken")) return new Response(JSON.stringify({ accesstoken: "token-1" }));
      return new Response(JSON.stringify([{ id: "sp-9", name: "Freezer", battery_voltage: 2.8 }]));
    };
    const result = await refreshSensorCatalog(
      { DB: m.db, SENSORPUSH_EMAIL: "a@b.c", SENSORPUSH_PASSWORD: "secret", SENSORPUSH_API_BASE: "https://fixture.test/api/v1" },
      fetchImpl
    );
    expect(result.error).toBeNull();
    expect(m.get(`SELECT name FROM sensor_catalog WHERE sensor_id = 'sp-9'`)?.name).toBe("Freezer");
    const pullsBefore = m.get(`SELECT COUNT(*) AS n FROM environment_pulls`)?.n;
    const refused: typeof fetch = async () => new Response("no", { status: 429 });
    const failed = await refreshSensorCatalog(
      { DB: m.db, SENSORPUSH_EMAIL: "a@b.c", SENSORPUSH_PASSWORD: "secret", SENSORPUSH_API_BASE: "https://fixture.test/api/v1" },
      refused
    );
    expect(failed.error).toBe("HTTP 429");
    expect(m.get(`SELECT COUNT(*) AS n FROM environment_pulls`)?.n).toBe(pullsBefore);
    const flash = environmentPage(await loadEnvironmentPage(m.db), "en", "refused", "429");
    expect(flash).toContain('data-env-refused');
    expect(flash).toContain("Re-read refused: HTTP 429");
    expect(environmentPage(await loadEnvironmentPage(m.db), "es", "refused", "429")).toContain("Relectura rechazada: HTTP 429");
  });

  it("HF1: reads the newest row per named sensor and the door rooms from the lookups, never by scanning every reading", async () => {
    const m = await migratedDb();
    // 3,000 readings for one unit and 3,000 for another: the newest of each must come back, and only theirs.
    const stmt = `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, sensor_id, role)
      VALUES (?, 'CSA', ?, 50, 'silo-ops', ?, ?, ?, NULL)`;
    for (let i = 0; i < 3000; i += 1) {
      const at = new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString();
      m.run(stmt, `a-${i}`, 60 + (i % 7), at, at, "unit-a");
      m.run(stmt, `b-${i}`, 70 + (i % 5), at, at, "unit-b");
    }
    const newest = await newestReadings(m.db, ["unit-a", "unit-b", "unit-none", " ", "unit-a"]);
    expect([...newest.keys()].sort()).toEqual(["unit-a", "unit-b"]);
    expect(newest.get("unit-a")?.read_at).toBe(new Date(Date.UTC(2026, 8, 1, 0, 2999)).toISOString());
    expect(newest.get("unit-b")?.temperature_f).toBe(70 + (2999 % 5));
    expect(await newestReadings(m.db, [])).toEqual(new Map());
    // The door rooms come from app_config's cure rooms and the dry spaces, CSA and CSB when the config is blank.
    const rooms = await doorRoomNames(m.db);
    expect(rooms).toContain("CSA");
    expect(rooms).toContain("CSB");
    const doors = await listDoorAverages(m.db);
    expect(doors.map((d) => d.room)).toEqual(["CSA"]);
    expect(doors[0].units).toBe(2);
  });

  it("words a cure pane flag in the shell locale", async () => {
    const m = await migratedDb();
    const person = seedPerson(m, "person-es");
    const readAt = "2026-09-27T15:50:00.000Z";
    m.run(
      `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at)
       VALUES ('r-csa', 'CSA', 104.2, 50, 'sensorpush', ?, ?)`,
      readAt,
      readAt
    );
    await saveEnvironmentRange(m.db, formOf({ person_id: person, space_name: "CSA", role: "room", temp_high: "100", reason: "the room" }));
    const es = await listCurePanes(m.db, "2026-09-27T16:00:00.000Z", "es");
    expect(es.flags?.CSA).toEqual(["Sala 104.2 F, sobre 100 F"]);
    expect(curePanes(es, "es")).toContain("Sala 104.2 F, sobre 100 F");
    expect(curePanes(es, "es")).toContain("cure-stale");
  });

  it("shows door units under their room without a binding, and flags the room mean", async () => {
    const m = await migratedDb();
    const db = m.db;
    const person = seedPerson(m, "person-door");
    const newest = "2026-09-22T03:00:00.000Z";
    m.run(
      `INSERT INTO sensor_catalog (sensor_id, name, battery_voltage, seen_at) VALUES ('sp-pull', 'Pull unit', 3, ?)`,
      newest
    );
    m.run(
      `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, sensor_id, role)
       VALUES ('pull-1', 'CSA', 200, 10, 'sensorpush', ?, ?, 'sp-pull', 'room')`,
      newest,
      newest
    );
    await storeSensorReadings(
      db,
      [70, 71, 72, 73].map((temperature_f, i) => ({
        room: "CSA",
        temperature_f,
        humidity_pct: 50,
        read_at: newest,
        source: "silo-ops",
        sensor_id: `door-unit-${i + 1}`,
      })),
      newest
    );
    const page = await loadEnvironmentPage(db);
    const html = environmentPage(page, "en");
    expect(html).toContain('data-env-sensor="sp-pull"');
    expect(html).toContain("200 F");
    const roomAt = html.indexOf('data-env-room="CSA"');
    const room = html.slice(roomAt, html.indexOf("</p>", roomAt));
    expect(room).toContain("CSA: 71.5 F");
    expect(room).toContain("4 units");
    expect(room).not.toContain("200");
    await saveEnvironmentRange(db, formOf({ person_id: person, space_name: "CSA", role: "room", temp_high: "71", reason: "the mean" }));
    const panes = await listCurePanes(db, "2026-09-22T03:10:00.000Z", "en");
    expect(panes.flags?.CSA).toEqual(["Room 71.5 F, above 71 F"]);
    expect(curePanes(panes, "en")).toContain("71.5 F · 50 % · 4 units");
  });
});
