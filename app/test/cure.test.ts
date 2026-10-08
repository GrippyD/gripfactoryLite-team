import { describe, expect, it } from "vitest";
import {
  conditionsLine,
  csaInTime,
  cureMembership,
  curePanes,
  isTestSensorSource,
  latestReading,
  listCurePanes,
  moistureText,
  parseCureRooms,
  pickMoisture,
  readingTitle,
  storeSensorReadings,
  type CurePanesData,
} from "../src/cure";
import { migratedDb } from "./migrated";

const NOW = "2026-09-21T16:00:00.000Z";

function dbOf(input: {
  lots?: Record<string, unknown>[];
  tests?: Record<string, unknown>[];
  reading?: { temperature_f: number; humidity_pct: number; read_at: string } | null;
  rooms?: string;
  inserts?: unknown[][];
}) {
  const inserts = input.inserts ?? [];
  return {
    inserts,
    prepare(sql: string) {
      const self = {
        bind(...args: unknown[]) {
          (self as { args: unknown[] }).args = args;
          return self;
        },
        args: [] as unknown[],
        async all() {
          if (sql.includes("FROM wet_weight_entries")) return { results: input.lots ?? [] };
          if (sql.includes("internal_test_results")) return { results: input.tests ?? [] };
          if (sql.includes("sensor_readings") && sql.includes("read_at >=") && input.reading) {
            const room = (self as { args: unknown[] }).args[0];
            if (room !== "CSA") return { results: [] };
            return {
              results: [
                {
                  sensor_id: null,
                  temperature_f: input.reading.temperature_f,
                  humidity_pct: input.reading.humidity_pct,
                  read_at: input.reading.read_at,
                  source: null,
                },
              ],
            };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes("sensor_readings")) {
            const room = (self as { args: unknown[] }).args[0];
            return room === "CSA" ? (input.reading ?? null) : null;
          }
          if (sql.includes("app_config")) return { value: input.rooms ?? "CSA,CSB" };
          return null;
        },
        async run() {
          inserts.push((self as { args: unknown[] }).args);
          return { success: true };
        },
      };
      return self;
    },
    async batch(stmts: { run: () => Promise<unknown> }[]) {
      for (const stmt of stmts) await stmt.run();
    },
  };
}

describe("THE CURE PANES (canon 0.30.164)", () => {
  it("puts a scheduled trim row on CSB, a complete row on neither pane, a deleted row back on CSA, and a trimmed, frozen, or voided lot on neither", () => {
    expect(cureMembership({ status: "unloaded", deleted: false, trimStatus: "scheduled" })).toBe("CSB");
    expect(cureMembership({ status: "unloaded", deleted: false, trimStatus: "complete" })).toBeNull();
    expect(cureMembership({ status: "trimmed", deleted: false, trimStatus: "scheduled" })).toBeNull();
    expect(cureMembership({ status: "trimmed", deleted: false, trimStatus: "complete" })).toBeNull();
    expect(cureMembership({ status: "trimmed", deleted: false, trimStatus: null })).toBeNull();
    expect(cureMembership({ status: "unloaded", deleted: false, trimStatus: null })).toBe("CSA");
    expect(cureMembership({ status: "unloaded", deleted: false, trimStatus: "" })).toBe("CSA");
    expect(cureMembership({ status: "frozen", deleted: false, trimStatus: "scheduled" })).toBeNull();
    expect(cureMembership({ status: "unloaded", deleted: true, trimStatus: null })).toBeNull();
    expect(cureMembership({ status: "unloaded", deleted: true, trimStatus: "scheduled" })).toBeNull();
  });

  it("takes the unload finish as CSA's in-time, and the change log when the session has none", () => {
    expect(csaInTime("2026-09-21T12:00:00.000Z", "2026-09-21T11:00:00.000Z")).toBe("2026-09-21T12:00:00.000Z");
    expect(csaInTime(null, "2026-09-21T11:00:00.000Z")).toBe("2026-09-21T11:00:00.000Z");
    expect(csaInTime("", null)).toBeNull();
  });

  it("picks moisture over water activity, at in-time versus the newest", () => {
    const rows = [
      { analyte: "moisture", value: 12.2, tested_at: "2026-09-21T10:00:00.000Z" },
      { analyte: "water_activity", value: 0.7, tested_at: "2026-09-21T14:00:00.000Z" },
      { analyte: "moisture", value: 11.4, tested_at: "2026-09-21T15:00:00.000Z" },
    ];
    const at = pickMoisture(rows.filter((r) => r.tested_at <= "2026-09-21T12:00:00.000Z"));
    expect(at).toEqual({ kind: "moisture", text: "12.2 %", testedAt: "2026-09-21T10:00:00.000Z" });
    const latest = pickMoisture(rows);
    expect(latest?.kind).toBe("moisture");
    expect(latest?.text).toBe("11.4 %");
    expect(pickMoisture([{ analyte: "water_activity", value: 0.62, tested_at: "2026-09-21T10:00:00.000Z" }])?.text).toBe("0.62 aw");
    expect(pickMoisture([])).toBeNull();
    expect(moistureText("moisture", 11)).toBe("11 %");
  });

  it("lists CSA and CSB from the fixture rows and renders the pane marks", async () => {
    const db = dbOf({
      lots: [
        {
          id: "lot-csa",
          status: "unloaded",
          dry_weight_grams: 448,
          hbn: "26264-PNN-GL-070-0-NA-26021",
          metrc_harvest_tag: "1A4060300003E5B000011111",
          unload_finished_at: "2026-09-21T12:00:00.000Z",
          unloaded_logged_at: null,
          trim_scheduled_at: null,
          trim_status: null,
          live_grams: 400,
        },
        {
          id: "lot-csb",
          status: "unloaded",
          dry_weight_grams: 896,
          hbn: "26264-PNN-GL-070-0-NA-26022",
          metrc_harvest_tag: null,
          unload_finished_at: "2026-09-20T12:00:00.000Z",
          unloaded_logged_at: null,
          trim_scheduled_at: "2026-09-21T13:00:00.000Z",
          trim_status: "scheduled",
          live_grams: 800,
        },
        {
          id: "lot-done",
          status: "unloaded",
          dry_weight_grams: 100,
          hbn: "26264-PNN-GL-070-0-NA-26023",
          metrc_harvest_tag: null,
          unload_finished_at: null,
          unloaded_logged_at: null,
          trim_scheduled_at: "2026-09-21T14:00:00.000Z",
          trim_status: "complete",
          live_grams: null,
        },
        {
          id: "lot-frozen",
          status: "frozen",
          dry_weight_grams: 100,
          hbn: "26264-PNN-GL-070-0-NA-26024",
          metrc_harvest_tag: null,
          unload_finished_at: null,
          unloaded_logged_at: null,
          trim_scheduled_at: null,
          trim_status: null,
          live_grams: null,
        },
      ],
      tests: [
        { hbn: "26264-PNN-GL-070-0-NA-26021", package_tag: null, analyte: "moisture", value: 11.4, tested_at: "2026-09-21T11:00:00.000Z" },
        { hbn: null, package_tag: "1A4060300003E5B000011111", analyte: "moisture", value: 10, tested_at: "2026-09-21T15:00:00.000Z" },
      ],
      reading: { temperature_f: 68.2, humidity_pct: 58, read_at: "2026-09-21T15:56:00.000Z" },
    });
    const data = await listCurePanes(db as unknown as D1Database, NOW);
    expect(data.csa.map((l) => l.id)).toEqual(["lot-csa"]);
    expect(data.csb.map((l) => l.id)).toEqual(["lot-csb"]);
    expect([...data.csa, ...data.csb].some((l) => l.id === "lot-done")).toBe(false);
    expect(data.csa[0].inTime).toBe("2026-09-21T12:00:00.000Z");
    expect(data.csb[0].inTime).toBe("2026-09-21T13:00:00.000Z");
    expect(data.csa[0].moistureAt?.text).toBe("11.4 %");
    expect(data.csa[0].moistureLatest?.text).toBe("10 %");
    expect(data.csa[0].shortId).toBe("26021");
    expect(data.caps).toEqual({ CSA: 36, CSB: 8 });
    const html = curePanes(data, "en");
    expect(html).toContain('data-cure-pane="CSA"');
    expect(html).toContain('data-cure-pane="CSB"');
    expect(html).toContain('data-cure-lot="lot-csa"');
    expect(html).toContain('data-cure-lot="lot-csb"');
    expect(html).toContain("data-cure-clock");
    expect(html).toContain("data-cure-conditions");
    expect(html).toContain("68.2 F");
    expect(html).toContain("1.00 lb");
    expect(html).toContain("no sensor yet");
    // THE ROW FOLDS ON THE LOT NUMBER (owner, 2026-09-22): a details element, the lot number and the time in on its summary line,
    // the weight, the moistures and the lot record link under it; folded until pressed.
    const row = html.slice(html.indexOf('<details class="cure-row" data-cure-lot="lot-csa">'), html.indexOf("</details>") + "</details>".length);
    expect(row).toContain('<summary class="cure-head" data-cure-head><span class="cure-id">26021</span> <span class="cure-clock" data-cure-clock data-started="');
    expect(row.indexOf("cure-id")).toBeLessThan(row.indexOf("cure-clock"));
    expect(row.indexOf("</summary>")).toBeLessThan(row.indexOf('class="cure-weight"'));
    expect(row).toContain('<a class="cure-link" href="/record/wet_weight_entries/lot-csa/edit">Lot record</a>');
    expect(row).not.toContain("<details open");
    // THE PANES RIDE THE STRIP (owner, 2026-09-22): two inv-gauge tiles and the clock script, no wrapper of their own.
    expect(html).not.toContain("cure-panes");
    expect(html.startsWith('<div class="inv-gauge cure-pane dry-tile" data-cure-pane="CSA" title="2026-09-21 11:56 ET" data-dry-tile>')).toBe(true);
    expect(html.indexOf('data-cure-pane="CSA"')).toBeLessThan(html.indexOf('data-cure-pane="CSB"'));
    expect(html.indexOf('data-cure-pane="CSB"')).toBeLessThan(html.indexOf("<script>"));
    const es = curePanes({ ...data, readings: { CSA: null, CSB: null } }, "es");
    expect(es).toContain("Humedad al entrar");
    expect(es).toContain("aun no hay sensor");
    expect(es).toContain("sin lectura");
    expect(es).toContain("Registro del lote");
  });

  it("validates a reading and refuses in words", async () => {
    const inserts: unknown[][] = [];
    const db = dbOf({ inserts, rooms: "CSA,CSB" });
    const stored = await storeSensorReadings(
      db as unknown as D1Database,
      { room: "csa", temperature_f: 68.2, humidity_pct: 58, read_at: "2026-09-21T15:00:00Z", source: "silo-ops" },
      NOW
    );
    expect(stored).toEqual({ stored: 1, skipped: 0 });
    expect(inserts[0]?.[8]).toBeNull();
    expect(inserts[0]?.[1]).toBe("CSA");
    expect(inserts[0]?.[4]).toBe("silo-ops");
    await expect(storeSensorReadings(db as unknown as D1Database, { room: "NOPE", temperature_f: 70, humidity_pct: 40, read_at: NOW }, NOW)).rejects.toThrow(
      /room/
    );
    await expect(storeSensorReadings(db as unknown as D1Database, { room: "CSA", temperature_f: 70, humidity_pct: 140, read_at: NOW }, NOW)).rejects.toThrow(
      /humidity/
    );
    await expect(storeSensorReadings(db as unknown as D1Database, { room: "CSA", temperature_f: 70, humidity_pct: 40, read_at: "yesterday" }, NOW)).rejects.toThrow(
      /read_at/
    );
    await expect(storeSensorReadings(db as unknown as D1Database, [], NOW)).rejects.toThrow(/No readings/);
    const many = Array.from({ length: 101 }, () => ({ room: "CSA", temperature_f: 70, humidity_pct: 40, read_at: NOW }));
    await expect(storeSensorReadings(db as unknown as D1Database, many, NOW)).rejects.toThrow(/100/);
    expect(parseCureRooms("csa, csb, CSA")).toEqual(["CSA", "CSB"]);
    expect(parseCureRooms("")).toEqual(["CSA", "CSB"]);
  });

  it("marks a reading older than an hour in red words", () => {
    const fresh = conditionsLine({ temperatureF: 68, humidityPct: 58, readAt: "2026-09-21T15:56:00.000Z" }, NOW, "en");
    expect(fresh.stale).toBe(false);
    expect(fresh.text).toContain("4 min ago");
    const old = conditionsLine({ temperatureF: 60, humidityPct: 70, readAt: "2026-09-21T14:00:00.000Z" }, NOW, "en");
    expect(old.stale).toBe(true);
    const none = conditionsLine(null, NOW, "en");
    expect(none.text).toBe("no sensor yet");
    const html = curePanes(
      {
        csa: [],
        csb: [],
        readings: { CSA: { temperatureF: 60, humidityPct: 70, readAt: "2026-09-21T14:00:00.000Z" }, CSB: null },
        nowIso: NOW,
        caps: { CSA: 36, CSB: 8 },
      } satisfies CurePanesData,
      "en"
    );
    expect(html).toContain("cure-stale");
    const silo = conditionsLine({ temperatureF: 68.2, humidityPct: 58, readAt: "2026-09-21T15:56:00.000Z", source: "silo-ops" }, NOW, "en");
    expect(silo.text.endsWith(" · Silo Ops")).toBe(true);
    expect(silo.text).toContain("68.2 F · 58 % · 4 min ago · Silo Ops");
    expect(conditionsLine({ temperatureF: 68.2, humidityPct: 58, readAt: "2026-09-21T15:56:00.000Z", source: "SILO-OPS" }, NOW, "es").text.endsWith(" · Silo Ops")).toBe(true);
    expect(conditionsLine({ temperatureF: 68.2, humidityPct: 58, readAt: "2026-09-21T15:56:00.000Z", source: "sensorpush" }, NOW, "en").text.endsWith(" · Silo Ops")).toBe(false);
    expect(readingTitle({ temperatureF: 68.2, humidityPct: 58, readAt: "2026-09-21T15:56:00.000Z", source: "silo-ops" })).toBe("2026-09-21 11:56 ET · silo-ops");
    const titled = curePanes(
      {
        csa: [],
        csb: [],
        readings: { CSA: { temperatureF: 68.2, humidityPct: 58, readAt: "2026-09-21T15:56:00.000Z", source: "silo-ops" }, CSB: null },
        nowIso: NOW,
        caps: { CSA: 36, CSB: 8 },
      } satisfies CurePanesData,
      "en"
    );
    expect(titled).toContain('data-cure-pane="CSA" title="2026-09-21 11:56 ET · silo-ops"');
    expect(titled).toContain("68.2 F · 58 % · 4 min ago · Silo Ops");
    expect(isTestSensorSource("test")).toBe(true);
    expect(isTestSensorSource(" TEST ")).toBe(true);
    expect(isTestSensorSource("silo-ops")).toBe(false);
  });

  it("passes over a test reading and shows a silo-ops row, newer or older", async () => {
    const m = await migratedDb();
    const insert = (id: string, room: string, source: string, readAt: string, temp = 68.2, humid: number | null = 58) => {
      m.run(
        `INSERT INTO sensor_readings (id, room, temperature_f, humidity_pct, source, read_at, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        room,
        temp,
        humid,
        source,
        readAt,
        readAt
      );
    };
    insert("r-test", "CSA", "test", "2026-09-22T02:31:00.000Z");
    expect(await latestReading(m.db as unknown as D1Database, "CSA")).toBeNull();
    const onlyTest = await listCurePanes(m.db as unknown as D1Database, NOW);
    expect(onlyTest.readings.CSA).toBeNull();
    expect(curePanes(onlyTest, "en")).toContain("no sensor yet");
    expect(m.get(`SELECT source FROM sensor_readings WHERE id = 'r-test'`)?.source).toBe("test");
    insert("r-silo-old", "CSA", "silo-ops", "2026-09-21T12:00:00.000Z", 70, 40);
    const older = await latestReading(m.db as unknown as D1Database, "CSA");
    expect(older).toMatchObject({ temperatureF: 70, humidityPct: 40, source: "silo-ops", readAt: "2026-09-21T12:00:00.000Z" });
    insert("r-silo-new", "CSA", " SILO-OPS ", "2026-09-22T03:00:00.000Z", 72.4, 55);
    const newer = await latestReading(m.db as unknown as D1Database, "CSA");
    expect(newer).toMatchObject({ temperatureF: 72.4, humidityPct: 55, source: "SILO-OPS", readAt: "2026-09-22T03:00:00.000Z" });
    insert("r-test-newer", "CSA", "TEST", "2026-09-22T04:00:00.000Z", 99, 99);
    const stillSilo = await latestReading(m.db as unknown as D1Database, "CSA");
    expect(stillSilo?.readAt).toBe("2026-09-22T03:00:00.000Z");
    expect(stillSilo?.source).toBe("SILO-OPS");
    const shown = await listCurePanes(m.db as unknown as D1Database, "2026-09-22T03:10:00.000Z");
    const html = curePanes(shown, "en");
    expect(html).toContain("72.4 F · 55 % · 10 min ago · Silo Ops");
    expect(html).toContain('title="2026-09-21 23:00 ET · SILO-OPS"');
  });

  it("a full batch of 100 units binds at most 100 parameters per statement (D1's limit)", async () => {
    const m = await migratedDb();
    const real = m.db as unknown as D1Database;
    let most = 0;
    const guarded = new Proxy(real, {
      get(target, prop, receiver) {
        if (prop !== "prepare") return Reflect.get(target, prop, receiver);
        return (sql: string) => {
          const stmt = target.prepare(sql);
          return new Proxy(stmt, {
            get(s, key, r) {
              if (key !== "bind") return Reflect.get(s, key, r);
              return (...args: unknown[]) => {
                most = Math.max(most, args.length);
                if (args.length > 100) throw new Error("too many SQL variables");
                return s.bind(...args);
              };
            },
          });
        };
      },
    }) as D1Database;
    const at = "2026-09-22T03:00:00.000Z";
    const units = Array.from({ length: 100 }, (_, i) => ({ room: "CSA", temperature_f: 70, humidity_pct: 40, read_at: at, source: "silo-ops", sensor_id: `unit-${i}` }));
    expect(await storeSensorReadings(guarded, units, at)).toEqual({ stored: 100, skipped: 0 });
    expect(await storeSensorReadings(guarded, units, at)).toEqual({ stored: 0, skipped: 100 });
    const doors = Array.from({ length: 100 }, (_, i) => ({ room: "CSB", temperature_f: 70, humidity_pct: 40, read_at: new Date(Date.parse(at) + i * 60000).toISOString(), source: "manual" }));
    expect(await storeSensorReadings(guarded, doors, at)).toEqual({ stored: 100, skipped: 0 });
    expect(await storeSensorReadings(guarded, doors, at)).toEqual({ stored: 0, skipped: 100 });
    expect(most).toBeLessThanOrEqual(100);
  });

  it("keeps a sensor id, skips a resend, and writes nothing when one reading in the batch is bad", async () => {
    const m = await migratedDb();
    const db = m.db as unknown as D1Database;
    const at = "2026-09-22T03:00:00.000Z";
    const unit = { room: "CSA", temperature_f: 70, humidity_pct: 40, read_at: at, source: "silo-ops", sensor_id: "  unit-a  " };
    const first = await storeSensorReadings(db, unit, at);
    expect(first).toEqual({ stored: 1, skipped: 0 });
    expect(m.get(`SELECT sensor_id, room, source FROM sensor_readings`)?.sensor_id).toBe("unit-a");
    const again = await storeSensorReadings(db, unit, at);
    expect(again).toEqual({ stored: 0, skipped: 1 });
    const batch = await storeSensorReadings(db, [unit, { ...unit, temperature_f: 71 }], at);
    expect(batch).toEqual({ stored: 0, skipped: 2 });
    const freshPair = await storeSensorReadings(
      db,
      [
        { room: "CSA", temperature_f: 66, humidity_pct: 40, read_at: at, source: "silo-ops", sensor_id: "unit-pair" },
        { room: "CSA", temperature_f: 67, humidity_pct: 41, read_at: at, source: "silo-ops", sensor_id: "unit-pair" },
      ],
      at
    );
    expect(freshPair).toEqual({ stored: 1, skipped: 1 });
    expect(m.get(`SELECT temperature_f FROM sensor_readings WHERE sensor_id = 'unit-pair'`)?.temperature_f).toBe(66);
    const doorFresh = await storeSensorReadings(
      db,
      [
        { room: "CSA", temperature_f: 61, humidity_pct: 31, read_at: "2026-09-22T04:00:00.000Z", source: "manual" },
        { room: "CSA", temperature_f: 62, humidity_pct: 32, read_at: "2026-09-22T04:00:00.000Z", source: "manual" },
      ],
      at
    );
    expect(doorFresh).toEqual({ stored: 1, skipped: 1 });
    const door = { room: "CSB", temperature_f: 60, humidity_pct: 30, read_at: at, source: "manual" };
    expect(await storeSensorReadings(db, door, at)).toEqual({ stored: 1, skipped: 0 });
    expect(await storeSensorReadings(db, [door, door], at)).toEqual({ stored: 0, skipped: 2 });
    expect(await storeSensorReadings(db, { ...door, source: "other" }, at)).toEqual({ stored: 1, skipped: 0 });
    const beforeBad = m.get(`SELECT COUNT(*) AS n FROM sensor_readings`)?.n;
    await expect(
      storeSensorReadings(
        db,
        [
          { room: "CSA", temperature_f: 70, humidity_pct: 40, read_at: at, source: "silo-ops", sensor_id: "unit-b" },
          { room: "NOPE", temperature_f: 70, humidity_pct: 40, read_at: at, source: "silo-ops", sensor_id: "unit-c" },
        ],
        at
      )
    ).rejects.toThrow(/Reading 2/);
    const longId = "x".repeat(81);
    await expect(
      storeSensorReadings(db, { room: "CSA", temperature_f: 70, humidity_pct: 40, read_at: at, source: "silo-ops", sensor_id: longId }, at)
    ).rejects.toThrow(/Reading 1 sensor_id is too long/);
    expect(m.get(`SELECT COUNT(*) AS n FROM sensor_readings`)?.n).toBe(beforeBad);
    expect(m.get(`SELECT sensor_id FROM sensor_readings WHERE sensor_id = 'unit-b'`)).toBeUndefined();
  });

  it("averages the room's units inside 15 minutes, leaves an older unit out, and ignores a test source", async () => {
    const m = await migratedDb();
    const db = m.db as unknown as D1Database;
    const newest = "2026-09-22T03:00:00.000Z";
    const temps = [70, 71, 72, 73];
    const humids = [40, 50, 60, 70];
    await storeSensorReadings(
      db,
      [
        { room: "CSA", temperature_f: 10, humidity_pct: 10, read_at: "2026-09-22T02:44:00.000Z", source: "silo-ops", sensor_id: "unit-old" },
        ...temps.map((temperature_f, i) => ({
          room: "CSA",
          temperature_f,
          humidity_pct: humids[i],
          read_at: newest,
          source: "silo-ops",
          sensor_id: `unit-${i + 1}`,
        })),
        { room: "CSA", temperature_f: 99, humidity_pct: 99, read_at: "2026-09-22T03:30:00.000Z", source: "test", sensor_id: "unit-test" },
      ],
      newest
    );
    const reading = await latestReading(db, "CSA");
    expect(reading?.temperatureF).toBe(71.5);
    expect(reading?.humidityPct).toBe(55);
    expect(reading?.units).toBe(4);
    expect(reading?.readAt).toBe(newest);
    const shown = await listCurePanes(db, "2026-09-22T03:10:00.000Z");
    const html = curePanes(shown, "en");
    expect(html).toContain("71.5 F");
    expect(html).toContain("55 %");
    expect(html).toContain("4 units");
    expect(html).not.toContain("10 F");
    expect(curePanes(shown, "es")).toContain("4 unidades");
    expect(html).toContain('title="2026-09-21 23:00 ET · silo-ops"');
  });
});
