import { describe, expect, it } from "vitest";
import { etWallClock } from "../src/farmday";
import { t } from "../src/i18n";
import { isReportKey, REPORT_CARDS } from "../src/reports";
import {
  ENVIRONMENT_HISTORY_ROOMS_SQL,
  ENVIRONMENT_HISTORY_SQL,
  PURGE_CHUNK,
  PURGE_MAX_CHUNKS,
  addHours,
  environmentHistoryRooms,
  latestRolledHourStart,
  loadEnvironmentHistory,
  readSensorRetentionDays,
  resolveHistoryRange,
  rollupSensorHours,
  sensorRetentionDays,
} from "../src/sensorhistory";
import { migratedDb, type MigratedDb } from "./migrated";

type ReadingIn = {
  id: string;
  room: string;
  sensor: string | null;
  temp: number;
  hum: number | null;
  read: string;
  source?: string;
};

function putReadings(m: MigratedDb, rows: ReadingIn[]) {
  const size = 150;
  for (let i = 0; i < rows.length; i += size) {
    const part = rows.slice(i, i + size);
    const values = part.map(() => "(?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)").join(", ");
    const args: Array<string | number | null> = [];
    for (const row of part) args.push(row.id, row.room, row.temp, row.hum, row.source ?? "silo-ops", row.read, row.read, row.sensor);
    m.run(
      `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, raw, sensor_id, role) VALUES ${values}`,
      ...args
    );
  }
}

describe("SENSOR RETENTION (BRIEF SR1)", () => {
  it("holds the hour that has not ended two hours yet", () => {
    expect(latestRolledHourStart("2026-10-12T15:40:00.000Z")).toBe("2026-10-12T12:00:00.000Z");
    expect(latestRolledHourStart("2026-10-12T15:00:00.000Z")).toBe("2026-10-12T12:00:00.000Z");
    expect(latestRolledHourStart("2026-10-12T14:00:00.000Z")).toBe("2026-10-12T11:00:00.000Z");
  });

  it("reads retention from app_config and treats 0 or junk as 90", async () => {
    expect(sensorRetentionDays(null)).toBe(90);
    expect(sensorRetentionDays("")).toBe(90);
    expect(sensorRetentionDays("0")).toBe(90);
    expect(sensorRetentionDays("junk")).toBe(90);
    expect(sensorRetentionDays(" 30 ")).toBe(30);
    expect(sensorRetentionDays("90")).toBe(90);
    const m = await migratedDb();
    expect(await readSensorRetentionDays(m.db)).toBe(90);
    m.run(`UPDATE app_config SET value = '0' WHERE key = 'sensor_retention_days'`);
    expect(await readSensorRetentionDays(m.db)).toBe(90);
    m.run(`UPDATE app_config SET value = 'junk' WHERE key = 'sensor_retention_days'`);
    expect(await readSensorRetentionDays(m.db)).toBe(90);
    m.run(`UPDATE app_config SET value = '10' WHERE key = 'sensor_retention_days'`);
    expect(await readSensorRetentionDays(m.db)).toBe(10);
    m.run(`DELETE FROM app_config WHERE key = 'sensor_retention_days'`);
    expect(await readSensorRetentionDays(m.db)).toBe(90);
  });

  it("uses the configured days, and 0 or junk leave an 11-day row", async () => {
    const now = "2026-08-01T12:00:00.000Z";
    const cases: Array<[string | null, boolean]> = [
      ["10", true],
      ["0", false],
      ["junk", false],
      [null, false],
    ];
    for (const [value, gone] of cases) {
      const m = await migratedDb();
      if (value == null) m.run(`DELETE FROM app_config WHERE key = 'sensor_retention_days'`);
      else m.run(`UPDATE app_config SET value = ? WHERE key = 'sensor_retention_days'`, value);
      putReadings(m, [
        { id: "old", room: "CSA", sensor: "keep-days", temp: 70, hum: 40, read: "2026-07-21T12:00:00.000Z" },
        { id: "mid", room: "CSA", sensor: "keep-days", temp: 71, hum: 41, read: "2026-07-27T12:00:00.000Z" },
        { id: "new", room: "CSA", sensor: "keep-days", temp: 72, hum: 42, read: now },
      ]);
      await rollupSensorHours(m.db, now);
      expect(Boolean(m.get(`SELECT id FROM sensor_readings WHERE id = 'old'`))).toBe(!gone);
      expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'mid'`)).toBeTruthy();
      expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'new'`)).toBeTruthy();
    }
  });

  it("rolls 6000 readings, holds the open hour, and a rerun inserts nothing", async () => {
    const m = await migratedDb();
    const base = Date.parse("2026-08-01T00:00:00.000Z");
    const rows: ReadingIn[] = [];
    for (let h = 0; h < 50; h++) {
      const hour = base + h * 3_600_000;
      for (let minute = 0; minute < 40; minute++) {
        rows.push({
          id: `u1-${h}-${minute}`,
          room: "CSA",
          sensor: "u1",
          temp: 60 + (minute % 10),
          hum: 40 + (minute % 5),
          read: new Date(hour + minute * 60_000).toISOString(),
        });
      }
      for (let minute = 0; minute < 30; minute++) {
        rows.push({
          id: `u2-${h}-${minute}`,
          room: "CSA",
          sensor: "u2",
          temp: 70 + (minute % 3),
          hum: 50 + (minute % 2),
          read: new Date(hour + minute * 60_000).toISOString(),
        });
      }
      for (let minute = 0; minute < 50; minute++) {
        rows.push({
          id: `u3-${h}-${minute}`,
          room: "CSB",
          sensor: "u3",
          temp: 80,
          hum: 30,
          read: new Date(hour + minute * 60_000).toISOString(),
        });
      }
    }
    expect(rows).toHaveLength(6000);
    putReadings(m, rows);
    m.run(
      `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, sensor_id, role)
       VALUES ('test-row', 'CSA', 1, 1, 'test', '2026-08-01T00:10:00.000Z', '2026-08-01T00:10:00.000Z', NULL, NULL)`
    );
    const nowHold = "2026-08-03T03:30:00.000Z";
    expect(latestRolledHourStart(nowHold)).toBe("2026-08-03T00:00:00.000Z");
    const first = await rollupSensorHours(m.db, nowHold);
    expect(first.hours).toBe(24);
    expect(first.readings).toBe(24 * 120);
    expect(first.through).toBe("2026-08-01T23:00:00.000Z");
    const second = await rollupSensorHours(m.db, nowHold);
    expect(second.hours).toBe(24);
    expect(second.through).toBe("2026-08-02T23:00:00.000Z");
    const third = await rollupSensorHours(m.db, nowHold);
    expect(third.hours).toBe(1);
    expect(third.readings).toBe(120);
    expect(third.through).toBe("2026-08-03T00:00:00.000Z");
    const held = await rollupSensorHours(m.db, nowHold);
    expect(held.hours).toBe(0);
    expect(held.readings).toBe(0);
    expect(m.get(`SELECT value AS v FROM app_config WHERE key = 'sensor_rollup_through'`)?.v).toBe("2026-08-03T00:00:00.000Z");
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_hourly`)?.n).toBe(49 * 3);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_hourly WHERE hour_start = '2026-08-03T01:00:00.000Z'`)?.n).toBe(0);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_hourly WHERE source_key = 'test' OR source = 'test'`)?.n).toBe(0);
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'test-row'`)).toBeTruthy();

    const nowDone = "2026-08-03T06:00:00.000Z";
    const opened = await rollupSensorHours(m.db, nowDone);
    expect(opened.hours).toBe(3);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_hourly`)?.n).toBe(150);
    const again = await rollupSensorHours(m.db, nowDone);
    expect(again.hours).toBe(0);
    expect(again.readings).toBe(0);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_hourly`)?.n).toBe(150);
    expect(m.get(`SELECT value AS v FROM app_config WHERE key = 'sensor_rollup_through'`)?.v).toBe(latestRolledHourStart(nowDone));

    const hour0 = "2026-08-01T00:00:00.000Z";
    const u1 = m.get(
      `SELECT readings, temp_min, temp_max, temp_avg, hum_min, hum_max, hum_avg, first_read_at, last_read_at, source_key
       FROM sensor_hourly WHERE room = 'CSA' AND sensor_key = 'u1' AND hour_start = ?`,
      hour0
    );
    expect(u1).toMatchObject({
      readings: 40,
      temp_min: 60,
      temp_max: 69,
      hum_min: 40,
      hum_max: 44,
      source_key: "silo-ops",
      first_read_at: hour0,
      last_read_at: "2026-08-01T00:39:00.000Z",
    });
    expect(Number(u1?.temp_avg)).toBeCloseTo(64.5);
    expect(Number(u1?.hum_avg)).toBeCloseTo(42);
    const u2 = m.get(`SELECT readings, temp_min, temp_max, temp_avg, hum_avg FROM sensor_hourly WHERE sensor_key = 'u2' AND hour_start = ?`, hour0);
    expect(u2).toMatchObject({ readings: 30, temp_min: 70, temp_max: 72 });
    expect(Number(u2?.temp_avg)).toBeCloseTo(71);
    expect(Number(u2?.hum_avg)).toBeCloseTo(50.5);
    const u3 = m.get(`SELECT readings, temp_min, temp_max, temp_avg, hum_avg FROM sensor_hourly WHERE sensor_key = 'u3' AND hour_start = ?`, hour0);
    expect(Number(u3?.readings)).toBe(50);
    expect(Number(u3?.temp_avg)).toBeCloseTo(80);
    expect(Number(u3?.hum_avg)).toBeCloseTo(30);
    const last = m.get(`SELECT readings FROM sensor_hourly WHERE sensor_key = 'u1' AND hour_start = '2026-08-03T01:00:00.000Z'`);
    expect(last?.readings).toBe(40);
  });

  it("purges a late resend by age and leaves the hourly row", async () => {
    const m = await migratedDb();
    putReadings(m, [
      { id: "a", room: "CSA", sensor: "late", temp: 70, hum: 40, read: "2026-01-01T00:01:00.000Z" },
      { id: "b", room: "CSA", sensor: "late", temp: 80, hum: 50, read: "2026-01-01T00:02:00.000Z" },
    ]);
    const rolled = await rollupSensorHours(m.db, "2026-01-01T06:00:00.000Z");
    expect(rolled.hours).toBeGreaterThan(0);
    const before = m.get(`SELECT readings, temp_max, temp_avg FROM sensor_hourly WHERE sensor_key = 'late' AND hour_start = '2026-01-01T00:00:00.000Z'`);
    expect(before).toMatchObject({ readings: 2, temp_max: 80 });
    putReadings(m, [
      { id: "resend", room: "CSA", sensor: "late", temp: 200, hum: 90, read: "2026-01-01T00:50:00.000Z" },
      { id: "newer", room: "CSA", sensor: "late", temp: 55, hum: 33, read: "2026-01-01T04:00:00.000Z" },
    ]);
    await rollupSensorHours(m.db, "2026-05-01T00:00:00.000Z");
    const after = m.get(`SELECT readings, temp_max, temp_avg FROM sensor_hourly WHERE sensor_key = 'late' AND hour_start = '2026-01-01T00:00:00.000Z'`);
    expect(after).toMatchObject({ readings: 2, temp_max: 80 });
    expect(Number(after?.temp_avg)).toBeCloseTo(Number(before?.temp_avg));
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'resend'`)).toBeUndefined();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'newer'`)).toBeTruthy();
  });

  it("purges at most 500 by 20, keeps each newest row, and leaves the rest", async () => {
    const m = await migratedDb();
    const bulk: ReadingIn[] = [];
    const origin = Date.parse("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 10020; i++) {
      bulk.push({
        id: `bulk-${i}`,
        room: "CSA",
        sensor: "bulk",
        temp: 70,
        hum: 40,
        read: new Date(origin + (i + 1) * 1000).toISOString(),
      });
    }
    putReadings(m, bulk);
    putReadings(m, [
      { id: "keep", room: "CSA", sensor: "keep", temp: 61, hum: 41, read: "2026-01-01T00:10:00.000Z" },
      { id: "door", room: "CSB", sensor: null, temp: 62, hum: 42, read: "2026-01-01T00:05:00.000Z" },
      { id: "later", room: "CSA", sensor: "later", temp: 63, hum: 43, read: "2026-01-05T12:00:00.000Z" },
      { id: "later-new", room: "CSA", sensor: "later", temp: 64, hum: 44, read: "2026-06-01T00:00:00.000Z" },
      { id: "bulk-new", room: "CSA", sensor: "bulk", temp: 65, hum: 45, read: "2026-06-01T00:00:00.000Z" },
    ]);
    m.run(
      `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at, sensor_id, role)
       VALUES ('test-old', 'CSA', 1, 1, 'test', '2025-12-31T23:00:00.000Z', '2025-12-31T23:00:00.000Z', 'test-sensor', NULL)`
    );
    const rolled = await rollupSensorHours(m.db, "2026-01-02T12:00:00.000Z");
    expect(rolled.hours).toBe(24);
    expect(rolled.purged).toBe(0);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_hourly WHERE source = 'test' OR source_key = 'test'`)?.n).toBe(0);
    const hourlyBefore = m.get(`SELECT COUNT(*) AS n FROM sensor_hourly`)?.n;
    const purged = await rollupSensorHours(m.db, "2026-06-15T12:00:00.000Z");
    expect(purged.purged).toBe(PURGE_CHUNK * PURGE_MAX_CHUNKS);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_readings WHERE sensor_id = 'bulk' AND read_at < '2026-02-01'`)?.n).toBe(10020 - (10000 - 1));
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'test-old'`)).toBeUndefined();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'keep'`)).toBeTruthy();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'door'`)).toBeTruthy();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'later'`)).toBeTruthy();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'later-new'`)).toBeTruthy();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'bulk-new'`)).toBeTruthy();
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_hourly`)?.n).toBe(hourlyBefore);
    const rest = await rollupSensorHours(m.db, "2026-06-15T12:00:00.000Z");
    expect(rest.purged).toBe(21);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_readings WHERE sensor_id = 'bulk' AND read_at < '2026-02-01'`)?.n).toBe(0);
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'later'`)).toBeTruthy();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'keep'`)).toBeTruthy();
    expect(m.get(`SELECT id FROM sensor_readings WHERE id = 'door'`)).toBeTruthy();
    expect(addHours("2026-01-01T23:00:00.000Z", 1)).toBe("2026-01-02T00:00:00.000Z");
  });

  it("reads history from the hourly table, with the room average under several units", async () => {
    expect(ENVIRONMENT_HISTORY_SQL.toLowerCase()).not.toContain("sensor_readings");
    expect(ENVIRONMENT_HISTORY_ROOMS_SQL.toLowerCase()).not.toContain("sensor_readings");
    expect(ENVIRONMENT_HISTORY_SQL.match(/\?/g)).toHaveLength(3);
    expect(ENVIRONMENT_HISTORY_SQL).toContain("room = ?");
    expect(ENVIRONMENT_HISTORY_SQL).toContain("hour_start >= ?");
    expect(ENVIRONMENT_HISTORY_SQL).toContain("hour_start < ?");
    expect(isReportKey("environment_history")).toBe(true);
    expect(REPORT_CARDS.some((card) => card.key === "environment_history" && card.title === "Environment history")).toBe(true);
    expect(resolveHistoryRange("", "", "2026-10-12")).toEqual({ ok: true, from: "2026-10-06", to: "2026-10-12" });
    expect(resolveHistoryRange("2026-10-12", "2026-10-01", "2026-10-12").ok).toBe(false);
    expect(resolveHistoryRange("nope", "2026-10-12", "2026-10-12").ok).toBe(false);
    expect(t("es", "Environment history")).toBe("Historial del ambiente");
    expect(t("en", "Environment history")).toBe("Environment history");

    const m = await migratedDb();
    const hour = "2026-08-01T04:00:00.000Z";
    putReadings(m, [
      { id: "p1", room: "CSA", sensor: "sa", temp: 70, hum: 40, read: "2026-08-01T04:10:00.000Z" },
      { id: "p2", room: "CSA", sensor: "sa", temp: 80, hum: 50, read: "2026-08-01T04:20:00.000Z" },
      { id: "p3", room: "CSA", sensor: "sb", temp: 60, hum: 30, read: "2026-08-01T04:15:00.000Z" },
      { id: "raw-only", room: "RawOnly", sensor: "raw", temp: 123.4, hum: 1, read: "2026-08-01T04:10:00.000Z" },
      { id: "held", room: "CSA", sensor: "sa", temp: 111, hum: 1, read: "2026-08-01T07:50:00.000Z" },
    ]);
    m.run(
      `INSERT INTO sensor_hourly (
        id, room, sensor_id, role, source, sensor_key, source_key, hour_start, readings,
        temp_min, temp_max, temp_avg, hum_min, hum_max, hum_avg, first_read_at, last_read_at, rolled_at
      ) VALUES (
        'only', 'OnlyHourly', NULL, NULL, 'silo-ops', '', 'silo-ops', ?, 1,
        55, 55, 55, NULL, NULL, NULL, ?, ?, ?
      )`,
      hour,
      hour,
      hour,
      hour
    );
    await rollupSensorHours(m.db, "2026-08-01T08:00:00.000Z");
    const rooms = await environmentHistoryRooms(m.db);
    expect(rooms).toContain("OnlyHourly");
    expect(rooms).toContain("CSA");
    const page = await loadEnvironmentHistory(m.db, new URLSearchParams("from=2026-08-01&to=2026-08-01"), "2026-08-01", "en");
    expect(page.ok).toBe(true);
    const text = JSON.stringify(page.view.rows);
    expect(text).not.toContain("123.4");
    expect(text).not.toContain("111");
    expect(text).toContain("OnlyHourly");
    const csa = page.view.rows.filter((row) => row.room === "CSA");
    expect(csa.map((row) => row.unit)).toEqual(["sa", "sb", "Average"]);
    expect(csa[0]).toMatchObject({ hour: etWallClock(hour), readings: 2, temp_min: "70", temp_avg: "75", temp_max: "80" });
    expect(csa[2]).toMatchObject({ unit: "Average", readings: 3, temp_min: "60", temp_max: "80" });
    const one = await loadEnvironmentHistory(m.db, new URLSearchParams("from=2026-08-01&to=2026-08-01&room=CSB"), "2026-08-01", "en");
    expect(one.view.rows.every((row) => row.room === "CSB")).toBe(true);
    const es = await loadEnvironmentHistory(m.db, new URLSearchParams("from=2026-08-01&to=2026-08-01&room=CSA"), "2026-08-01", "es");
    expect(es.filterHtml).toContain("Sala");
    expect(es.filterHtml).toContain("Todas las salas");
    expect(es.view.rows.some((row) => row.unit === "Promedio")).toBe(true);
  });
});
